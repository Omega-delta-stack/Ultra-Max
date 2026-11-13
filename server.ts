import express, { Request, Response, NextFunction } from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { db, UserRole } from './src/server/db.js';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  validateOwnerPasswordStrength,
  isValidUrl,
  normalizeInviteCode,
} from './src/server/auth-crypto.js';
import {
  DIGITAL_HUB_CATEGORY_ID,
  normalizeHubUrl,
  detectPlatform,
  PLATFORM_META,
} from './src/utils/digitalHub.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSION_COOKIE_NAME = 'flux_session';
const SESSION_DURATION_HOURS = 72;

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// Security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Simple sliding-window in-memory rate limiter for auth endpoints
const rateLimitBuckets = new Map<string, number[]>();
function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.path}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    const now = Date.now();
    const timestamps = (rateLimitBuckets.get(key) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= maxRequests) {
      return res.status(429).json({ error: 'Too many authentication attempts. Please wait a few minutes and try again.' });
    }
    timestamps.push(now);
    rateLimitBuckets.set(key, timestamps);
    next();
  };
}
const authRateLimiter = createRateLimiter(25, 5 * 60 * 1000);

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const name = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (name) {
      try {
        result[name] = decodeURIComponent(val);
      } catch {
        result[name] = val;
      }
    }
  }
  return result;
}

function isHttpsRequest(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const maxAge = SESSION_DURATION_HOURS * 3600;
  const https = isHttpsRequest(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAge}`,
    https ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (https) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req: Request, res: Response): void {
  const https = isHttpsRequest(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    https ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (https) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

// Extend Express Request type for authenticated user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role: UserRole;
    createdAt: string;
    isActive: boolean;
  };
  sessionToken?: string;
}

// Auth Middleware: Reads HttpOnly cookie or Authorization Bearer token and attaches user
const authMiddleware = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME] || null;

  const token = bearerToken || cookieToken;
  if (!token) {
    return next();
  }

  const session = db.getSession(token);
  if (!session) {
    return next();
  }

  const user = db.findUserById(session.userId);
  if (!user || !user.isActive) {
    return next();
  }

  req.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    isActive: user.isActive,
  };
  req.sessionToken = token;
  next();
};

app.use(authMiddleware);

// Route guards
const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  next();
};

const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Website owner authentication required.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Only the website owner can modify links or admin settings.' });
  }
  next();
};

// --- API ROUTES ---

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', storage: 'sqlite' });
});

// Public Portal Metadata & aggregate stats (no PII)
app.get('/api/public/portal-meta', (_req: Request, res: Response) => {
  const stats = db.getStats();
  res.json({
    name: 'ULTRA MEGA FLUX',
    tagline: 'BEYOND THE BOUNDARIES OF REALITY',
    totalLinks: stats.totalLinks,
    totalCategories: stats.totalCategories,
    totalMembers: stats.totalMembers,
    activeInviteCodes: stats.activeInviteCodes,
    totalClicks: stats.totalClicks,
    featuredLinksCount: stats.featuredLinksCount,
    status: 'OPTIMAL_FLUX_ACTIVE',
  });
});

// Verify invite code pre-check
app.get('/api/public/verify-code/:code', authRateLimiter, (req: Request, res: Response) => {
  const code = req.params.code;
  const record = db.findInvitationCode(code);
  if (!record) {
    return res.status(404).json({ valid: false, error: 'Invitation code not found in flux directory.' });
  }
  if (!record.isActive) {
    return res.status(400).json({ valid: false, error: 'Invitation code is inactive.' });
  }
  if (record.maxUses > 0 && record.timesUsed >= record.maxUses) {
    return res.status(400).json({ valid: false, error: 'Invitation code has reached maximum uses.' });
  }
  res.json({ valid: true });
});

// --- OMEGA CONTROL CENTER: PRIVATE OWNER PASSWORD AUTHENTICATION ---

app.get('/api/owner/status', (_req: Request, res: Response) => {
  res.json({
    ownerConfigured: db.isOwnerConfigured(),
  });
});

app.post('/api/owner/setup', authRateLimiter, (req: Request, res: Response) => {
  const { password, username } = req.body || {};

  if (typeof password !== 'string') {
    return res.status(400).json({ error: 'Private admin password is required.' });
  }

  const pwdCheck = validateOwnerPasswordStrength(password);
  if (!pwdCheck.valid) {
    return res.status(400).json({ error: pwdCheck.error });
  }

  let cleanUsername: string | undefined;
  if (username !== undefined && username !== '') {
    if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 40) {
      return res.status(400).json({ error: 'Owner username must be between 3 and 40 characters.' });
    }
    cleanUsername = username.trim();
  }

  if (db.isOwnerConfigured()) {
    return res.status(409).json({
      error: 'Owner password is already configured. Use your private admin password to unlock Omega Control Center.',
    });
  }

  const result = db.setupOwnerPassword(password, cleanUsername);
  if (!result.success || !result.user) {
    return res.status(400).json({ error: result.error || 'Failed to initialize owner vault.' });
  }

  const session = db.createSession(result.user.id, result.user.role, SESSION_DURATION_HOURS);
  setSessionCookie(req, res, session.token);

  res.status(201).json({
    token: session.token,
    user: {
      id: result.user.id,
      username: result.user.username,
      email: result.user.email,
      role: result.user.role,
      createdAt: result.user.createdAt,
    },
  });
});

app.post('/api/owner/login', authRateLimiter, (req: Request, res: Response) => {
  const { password } = req.body || {};

  if (!db.isOwnerConfigured()) {
    return res.status(409).json({
      error: 'Owner admin password has not been created yet. Complete first-time initialization first.',
    });
  }

  if (typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Private admin password is required.' });
  }

  const verified = db.verifyOwnerPassword(password);
  if (!verified.valid || !verified.user) {
    return res.status(401).json({ error: 'Invalid private admin password. Omega Control Center remains locked.' });
  }

  const session = db.createSession(verified.user.id, verified.user.role, SESSION_DURATION_HOURS);
  setSessionCookie(req, res, session.token);

  res.json({
    token: session.token,
    user: {
      id: verified.user.id,
      username: verified.user.username,
      email: verified.user.email,
      role: verified.user.role,
      createdAt: verified.user.createdAt,
    },
  });
});

app.post('/api/owner/change-password', requireAdmin, authRateLimiter, (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  const pwdCheck = validateOwnerPasswordStrength(newPassword);
  if (!pwdCheck.valid) {
    return res.status(400).json({ error: pwdCheck.error });
  }

  const result = db.changeOwnerPassword(currentPassword, newPassword, req.sessionToken);
  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Failed to update admin password.' });
  }

  res.json({ success: true, message: 'Private admin password updated successfully.' });
});

// --- MEMBER AUTHENTICATION ---

// Authentication: Login
app.post('/api/auth/login', authRateLimiter, (req: Request, res: Response) => {
  const { usernameOrEmail, password } = req.body || {};
  if (typeof usernameOrEmail !== 'string' || typeof password !== 'string' || !usernameOrEmail.trim() || !password) {
    return res.status(400).json({ error: 'Username/email and password are required.' });
  }

  const user = db.findUserByUsernameOrEmail(usernameOrEmail);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials. Access denied.' });
  }

  if (user.role === 'admin' && !db.isOwnerConfigured()) {
    return res.status(403).json({
      error: 'Owner password has not been created yet. Open Omega Control Center to create your private admin password.',
    });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: 'Account access has been deactivated. Contact an administrator.' });
  }

  const isValid = verifyPassword(password, user.passwordHash, user.salt);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials. Access denied.' });
  }

  const session = db.createSession(user.id, user.role, SESSION_DURATION_HOURS);
  setSessionCookie(req, res, session.token);

  res.json({
    token: session.token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
  });
});

// Authentication: Register with Invitation Code
app.post('/api/auth/register', authRateLimiter, (req: Request, res: Response) => {
  const { username, email, password, invitationCode } = req.body || {};

  if (
    typeof username !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof invitationCode !== 'string' ||
    !username.trim() ||
    !email.trim() ||
    !password ||
    !invitationCode.trim()
  ) {
    return res.status(400).json({ error: 'All fields including Invitation Code are required.' });
  }

  const trimmedUsername = username.trim();
  const trimmedEmail = email.trim().toLowerCase();

  if (trimmedUsername.length < 3 || trimmedUsername.length > 40) {
    return res.status(400).json({ error: 'Username must be between 3 and 40 characters.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail) || trimmedEmail.length > 120) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const pwdCheck = validatePasswordStrength(password);
  if (!pwdCheck.valid) {
    return res.status(400).json({ error: pwdCheck.error });
  }

  const { hash, salt } = hashPassword(password);
  const regResult = db.registerMemberWithInvitation({
    username: trimmedUsername,
    email: trimmedEmail,
    passwordHash: hash,
    salt,
    invitationCode,
  });

  if (!regResult.success || !regResult.user) {
    return res.status(regResult.status || 400).json({ error: regResult.error || 'Registration failed.' });
  }

  const newUser = regResult.user;
  const session = db.createSession(newUser.id, newUser.role, SESSION_DURATION_HOURS);
  setSessionCookie(req, res, session.token);

  res.status(201).json({
    token: session.token,
    user: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt,
    },
  });
});

// Authentication: Logout
app.post('/api/auth/logout', (req: AuthenticatedRequest, res: Response) => {
  if (req.sessionToken) {
    db.deleteSession(req.sessionToken);
  }
  clearSessionCookie(req, res);
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Authentication: Safe session probe (returns 200 whether signed in or anonymous)
app.get('/api/auth/session', (req: AuthenticatedRequest, res: Response) => {
  res.json({
    authenticated: Boolean(req.user),
    user: req.user || null,
  });
});

// Authentication: Current User (protected)
app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

// --- PUBLIC & MEMBER READ-ONLY ACCESSIBLE CONTENT ---

// Get Links (Public & Member read-only)
app.get('/api/links', (req: AuthenticatedRequest, res: Response) => {
  const categoryId = typeof req.query.category === 'string' ? req.query.category : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const onlyFeatured = req.query.featured === 'true';

  const links = db.getLinks({ categoryId, search, onlyFeatured });
  res.json(links);
});

// Get Categories (Public & Member read-only)
app.get('/api/categories', (_req: AuthenticatedRequest, res: Response) => {
  const categories = db.getCategories();
  res.json(categories);
});

// Record Link Click (Read-only visitor launch telemetry)
app.post('/api/links/:id/click', (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id;
  const newCount = db.recordLinkClick(id);
  if (newCount === null) {
    return res.status(404).json({ error: 'Link not found' });
  }
  res.json({ success: true, clickCount: newCount });
});

// --- DIGITAL LINK HUB: Public Read-Only List; Owner-Only Mutations ---

app.get('/api/digital-hub/links', (req: Request, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const links = db.getLinks({ categoryId: DIGITAL_HUB_CATEGORY_ID, search });
  res.json(links);
});

app.post('/api/digital-hub/links', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { title, url, description } = req.body || {};

  if (typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'A valid destination URL is required.' });
  }
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'A custom link title is required.' });
  }

  const trimmedTitle = title.trim();
  if (trimmedTitle.length > 200) {
    return res.status(400).json({ error: 'Link title must be 200 characters or fewer.' });
  }

  const urlCheck = normalizeHubUrl(url);
  if (!urlCheck.valid || !urlCheck.normalizedUrl) {
    return res.status(400).json({ error: urlCheck.error || 'Invalid URL provided.' });
  }

  const safeDescription = typeof description === 'string' ? description.trim().slice(0, 1000) : '';
  const platform = detectPlatform(urlCheck.normalizedUrl);
  const platformLabel = PLATFORM_META[platform].label;

  const created = db.createLink({
    title: trimmedTitle,
    url: urlCheck.normalizedUrl,
    categoryId: DIGITAL_HUB_CATEGORY_ID,
    description: safeDescription,
    tags: [platformLabel],
    isFeatured: false,
    createdByUserId: req.user!.id,
  });

  res.status(201).json(created);
});

app.put('/api/digital-hub/links/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id;
  const existing = db.getLinkById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Link not found in Digital Link Hub.' });
  }
  if (existing.categoryId !== DIGITAL_HUB_CATEGORY_ID) {
    return res.status(403).json({ error: 'Access forbidden: Link does not belong to Digital Link Hub.' });
  }

  const { title, url, description } = req.body || {};
  const updates: { title?: string; url?: string; description?: string; tags?: string[] } = {};

  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Link title cannot be empty.' });
    }
    if (title.trim().length > 200) {
      return res.status(400).json({ error: 'Link title must be 200 characters or fewer.' });
    }
    updates.title = title.trim();
  }

  if (url !== undefined) {
    if (typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'Destination URL cannot be empty.' });
    }
    const urlCheck = normalizeHubUrl(url);
    if (!urlCheck.valid || !urlCheck.normalizedUrl) {
      return res.status(400).json({ error: urlCheck.error || 'Invalid URL provided.' });
    }
    updates.url = urlCheck.normalizedUrl;
    const platform = detectPlatform(urlCheck.normalizedUrl);
    updates.tags = [PLATFORM_META[platform].label];
  }

  if (description !== undefined) {
    updates.description = typeof description === 'string' ? description.trim().slice(0, 1000) : '';
  }

  const updated = db.updateLink(id, updates);
  res.json(updated);
});

app.delete('/api/digital-hub/links/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id;
  const existing = db.getLinkById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Link not found in Digital Link Hub.' });
  }
  if (existing.categoryId !== DIGITAL_HUB_CATEGORY_ID) {
    return res.status(403).json({ error: 'Access forbidden: Link does not belong to Digital Link Hub.' });
  }

  db.deleteLink(id);
  res.json({ success: true, message: 'Link removed from Digital Link Hub.' });
});

// Bookmarks (Authenticated Members & Owner)
app.get('/api/bookmarks', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const bookmarks = db.getUserBookmarks(req.user!.id);
  res.json(bookmarks);
});

app.post('/api/bookmarks/:linkId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const linkId = req.params.linkId;
  const link = db.getLinkById(linkId);
  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }
  const bookmarks = db.toggleBookmark(req.user!.id, linkId);
  res.json({ bookmarks, isBookmarked: bookmarks.includes(linkId) });
});

// --- STRICT ROLE PROTECTION: BLOCK NON-OWNERS FROM MODIFYING ANYTHING ---
app.all(['/api/links', '/api/links/*', '/api/digital-hub', '/api/digital-hub/*'], (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && !req.path.endsWith('/click')) {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access forbidden: Only the authenticated website owner can modify links.' });
    }
  }
  next();
});

// --- OMEGA CONTROL CENTER (OWNER / ADMINISTRATOR-ONLY API ROUTES) ---

// Admin Stats
app.get('/api/admin/stats', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const stats = db.getStats();
  res.json(stats);
});

// Admin Add Link (supports both existing cosmic sectors and DIGITAL LINK HUB)
app.post('/api/admin/links', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { title, url, categoryId, description, tags, isFeatured } = req.body || {};

  if (typeof title !== 'string' || !title.trim() || typeof url !== 'string' || !url.trim() || typeof categoryId !== 'string' || !categoryId.trim()) {
    return res.status(400).json({ error: 'Title, URL, and Category are required.' });
  }

  if (title.trim().length > 200) {
    return res.status(400).json({ error: 'Link title must be 200 characters or fewer.' });
  }

  if (!db.getCategoryById(categoryId)) {
    return res.status(400).json({ error: 'Selected category does not exist.' });
  }

  let finalUrl = url.trim();
  if (categoryId === DIGITAL_HUB_CATEGORY_ID) {
    const check = normalizeHubUrl(finalUrl);
    if (!check.valid || !check.normalizedUrl) {
      return res.status(400).json({ error: check.error || 'Please enter a valid URL.' });
    }
    finalUrl = check.normalizedUrl;
  } else if (!isValidUrl(finalUrl)) {
    return res.status(400).json({ error: 'Please enter a valid URL starting with http:// or https://' });
  }

  let finalTags = Array.isArray(tags)
    ? tags.filter((t): t is string => typeof t === 'string')
    : typeof tags === 'string'
      ? tags.split(',')
      : [];

  if (categoryId === DIGITAL_HUB_CATEGORY_ID && finalTags.length === 0) {
    const platform = detectPlatform(finalUrl);
    finalTags = [PLATFORM_META[platform].label];
  }

  const newLink = db.createLink({
    title: title.trim(),
    url: finalUrl,
    categoryId,
    description: typeof description === 'string' ? description.trim().slice(0, 1000) : '',
    tags: finalTags,
    isFeatured: !!isFeatured,
    createdByUserId: req.user!.id,
  });

  res.status(201).json(newLink);
});

// Admin Edit Link
app.put('/api/admin/links/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id;
  const existing = db.getLinkById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Link not found' });
  }

  const { title, url, categoryId, description, tags, isFeatured } = req.body || {};

  if (title !== undefined && (typeof title !== 'string' || !title.trim() || title.trim().length > 200)) {
    return res.status(400).json({ error: 'Title must be a non-empty string up to 200 characters.' });
  }

  const targetCategoryId = typeof categoryId === 'string' && categoryId.trim() ? categoryId : existing.categoryId;
  if (categoryId !== undefined && !db.getCategoryById(targetCategoryId)) {
    return res.status(400).json({ error: 'Selected category does not exist.' });
  }

  let validatedUrl: string | undefined;
  if (url !== undefined) {
    if (typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'Please enter a valid URL starting with http:// or https://' });
    }
    if (targetCategoryId === DIGITAL_HUB_CATEGORY_ID) {
      const check = normalizeHubUrl(url);
      if (!check.valid || !check.normalizedUrl) {
        return res.status(400).json({ error: check.error || 'Invalid URL provided.' });
      }
      validatedUrl = check.normalizedUrl;
    } else {
      if (!isValidUrl(url.trim())) {
        return res.status(400).json({ error: 'Please enter a valid URL starting with http:// or https://' });
      }
      validatedUrl = url.trim();
    }
  }

  let parsedTags: string[] | undefined;
  if (tags !== undefined) {
    parsedTags = Array.isArray(tags)
      ? tags.filter((t): t is string => typeof t === 'string')
      : typeof tags === 'string'
        ? tags.split(',')
        : [];
  } else if (validatedUrl && targetCategoryId === DIGITAL_HUB_CATEGORY_ID) {
    parsedTags = [PLATFORM_META[detectPlatform(validatedUrl)].label];
  }

  const updated = db.updateLink(id, {
    title: typeof title === 'string' ? title.trim() : undefined,
    url: validatedUrl,
    categoryId: categoryId !== undefined ? targetCategoryId : undefined,
    description: typeof description === 'string' ? description.trim().slice(0, 1000) : undefined,
    tags: parsedTags,
    isFeatured,
  });

  res.json(updated);
});

// Admin Delete Link
app.delete('/api/admin/links/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id;
  const success = db.deleteLink(id);
  if (!success) {
    return res.status(404).json({ error: 'Link not found' });
  }
  res.json({ success: true, message: 'Link deleted successfully.' });
});

// Admin Add Category
app.post('/api/admin/categories', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { name, description, icon, order } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required.' });
  }
  const parsedOrder = typeof order === 'number' && Number.isFinite(order) ? order : undefined;
  const category = db.createCategory(
    name.trim(),
    typeof description === 'string' ? description : '',
    typeof icon === 'string' && icon.trim() ? icon.trim() : 'Link',
    parsedOrder
  );
  res.status(201).json(category);
});

// Admin Edit Category
app.put('/api/admin/categories/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id;
  const { name, description, icon, order } = req.body || {};
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    return res.status(400).json({ error: 'Category name cannot be empty.' });
  }
  const category = db.updateCategory(id, {
    name: typeof name === 'string' ? name.trim() : undefined,
    description: typeof description === 'string' ? description : undefined,
    icon: typeof icon === 'string' ? icon : undefined,
    order: typeof order === 'number' && Number.isFinite(order) ? order : undefined,
  });
  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }
  res.json(category);
});

// Admin Delete Category
app.delete('/api/admin/categories/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id;
  const result = db.deleteCategory(id);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true, message: 'Category deleted successfully.' });
});

// Admin Invitations List
app.get('/api/admin/invitations', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const codes = db.getInvitationCodes();
  res.json(codes);
});

// Admin Create Invitation
app.post('/api/admin/invitations', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { code, maxUses, note } = req.body || {};
  if (typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ error: 'Invitation code string is required.' });
  }
  const result = db.createInvitationCode(code, req.user!.id, maxUses, typeof note === 'string' ? note : '');
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.status(201).json(result.invitation);
});

// Admin Toggle Invitation Active
app.post('/api/admin/invitations/:id/toggle', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id;
  const result = db.toggleInvitationCode(id);
  if (!result.success) {
    return res.status(404).json({ error: result.error });
  }
  res.json(result.invitation);
});

// Admin Delete Invitation
app.delete('/api/admin/invitations/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id;
  const result = db.deleteInvitationCode(id);
  if (!result.success) {
    return res.status(404).json({ error: result.error });
  }
  res.json({ success: true });
});

// Admin Members List
app.get('/api/admin/members', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const members = db.getAllUsers();
  res.json(members);
});

// Admin Toggle Member Active
app.post('/api/admin/members/:id/toggle', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id;
  const result = db.toggleUserActive(id);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result.user);
});

// Return 404 JSON for unmatched /api/* endpoints instead of HTML fallback
app.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Centralized JSON error handler (prevents leaking stack traces)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// --- STATIC FILES / VITE INTEGRATION ---

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const httpServer = http.createServer(app);

  if (!isProduction) {
    // Development mode: Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve built static files
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🌌 ULTRA MEGA FLUX server active at http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    httpServer.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
