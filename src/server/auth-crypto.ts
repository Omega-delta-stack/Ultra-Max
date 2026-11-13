import crypto from 'node:crypto';

export interface HashResult {
  hash: string;
  salt: string;
}

/**
 * Hashes a plaintext password using PBKDF2 with SHA-512 and a cryptographically secure random salt.
 * Plaintext passwords are never stored.
 */
export function hashPassword(password: string, existingSalt?: string): HashResult {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Verifies a plaintext password against a stored hash and salt.
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  if (!password || !storedHash || !salt || password.length > 128) return false;
  const { hash } = hashPassword(password, salt);
  // Constant-time comparison to prevent timing attacks
  const hashBuffer = Buffer.from(hash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');
  if (hashBuffer.length !== storedBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, storedBuffer);
}

/**
 * Generates a secure random session token.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes a session token with SHA-256 before storing or looking up in the database.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Normalizes and validates an invitation code format.
 */
export function normalizeInviteCode(code: string): string {
  return (typeof code === 'string' ? code : '').trim().toUpperCase();
}

/**
 * Validates member password strength (6–128 chars).
 */
export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (typeof password !== 'string' || password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters long.' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password must be 128 characters or fewer.' };
  }
  return { valid: true };
}

/**
 * Validates owner admin password strength (8–128 chars, requires letters and a number or symbol).
 */
export function validateOwnerPasswordStrength(password: string): { valid: boolean; error?: string } {
  if (typeof password !== 'string' || password.length < 8) {
    return { valid: false, error: 'Admin password must be at least 8 characters long.' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Admin password must be 128 characters or fewer.' };
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return {
      valid: false,
      error: 'Admin password must include both letters and at least one number or symbol.',
    };
  }
  return { valid: true };
}

/**
 * Validates URLs for links.
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
