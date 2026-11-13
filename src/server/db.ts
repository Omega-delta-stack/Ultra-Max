import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  hashPassword,
  verifyPassword,
  hashSessionToken,
  normalizeInviteCode,
} from './auth-crypto.js';
import { DIGITAL_HUB_CATEGORY_ID } from '../utils/digitalHub.js';

export type UserRole = 'admin' | 'member';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  createdAt: string;
  isActive: boolean;
  invitationCodeUsed?: string;
}

export interface Session {
  token: string;
  userId: string;
  role: UserRole;
  createdAt: string;
  expiresAt: string;
}

export interface InvitationCode {
  id: string;
  code: string;
  createdByUserId: string;
  maxUses: number; // 0 = unlimited
  timesUsed: number;
  isActive: boolean;
  createdAt: string;
  note?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  order: number;
}

export interface LinkItem {
  id: string;
  title: string;
  url: string;
  categoryId: string;
  description: string;
  tags: string[];
  isFeatured: boolean;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
}

interface LegacyDatabaseSchema {
  users?: User[];
  invitationCodes?: InvitationCode[];
  categories?: Category[];
  links?: LinkItem[];
  bookmarks?: Record<string, string[]>;
}

const DEFAULT_DB_DIR = path.resolve(process.cwd(), 'data');
const DEFAULT_DB_FILE = path.join(DEFAULT_DB_DIR, 'flux.db');
const LEGACY_JSON_FILE = path.join(DEFAULT_DB_DIR, 'flux-database.json');
const OWNER_USER_ID = 'usr_admin_master';

function mapUserRow(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    username: String(row.username),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    salt: String(row.salt),
    role: row.role === 'admin' ? 'admin' : 'member',
    createdAt: String(row.created_at),
    isActive: Number(row.is_active) === 1,
    invitationCodeUsed: row.invitation_code_used ? String(row.invitation_code_used) : undefined,
  };
}

function mapCategoryRow(row: Record<string, unknown>): Category {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: String(row.description),
    icon: String(row.icon),
    order: Number(row.sort_order),
  };
}

function mapLinkRow(row: Record<string, unknown>): LinkItem {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(String(row.tags_json || '[]'));
    if (Array.isArray(parsed)) tags = parsed.map(String);
  } catch {
    tags = [];
  }
  return {
    id: String(row.id),
    title: String(row.title),
    url: String(row.url),
    categoryId: String(row.category_id),
    description: String(row.description || ''),
    tags,
    isFeatured: Number(row.is_featured) === 1,
    clickCount: Number(row.click_count || 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdByUserId: String(row.created_by_user_id),
  };
}

function mapInvitationRow(row: Record<string, unknown>): InvitationCode {
  return {
    id: String(row.id),
    code: String(row.code),
    createdByUserId: String(row.created_by_user_id),
    maxUses: Number(row.max_uses || 0),
    timesUsed: Number(row.times_used || 0),
    isActive: Number(row.is_active) === 1,
    createdAt: String(row.created_at),
    note: row.note ? String(row.note) : '',
  };
}

export class FluxDatabase {
  private sqlite: DatabaseSync;

  constructor(dbPath: string = DEFAULT_DB_FILE, legacyJsonPath: string | null = LEGACY_JSON_FILE) {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.sqlite = new DatabaseSync(dbPath, { timeout: 5000 });
    this.sqlite.exec('PRAGMA journal_mode = WAL;');
    this.sqlite.exec('PRAGMA foreign_keys = ON;');

    this.initSchema();
    this.bootstrapData(legacyJsonPath);
  }

  public close(): void {
    this.sqlite.close();
  }

  private initSchema(): void {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'member')),
        created_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        invitation_code_used TEXT
      );

      CREATE TABLE IF NOT EXISTS owner_state (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        owner_user_id TEXT NOT NULL,
        is_configured INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'member')),
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

      CREATE TABLE IF NOT EXISTS invitation_codes (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        created_by_user_id TEXT NOT NULL,
        max_uses INTEGER NOT NULL DEFAULT 0,
        times_used INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        note TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        icon TEXT NOT NULL DEFAULT 'Link',
        sort_order INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS links (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        category_id TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        is_featured INTEGER NOT NULL DEFAULT 0,
        click_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by_user_id TEXT NOT NULL,
        FOREIGN KEY(category_id) REFERENCES categories(id)
      );

      CREATE INDEX IF NOT EXISTS idx_links_category ON links(category_id);

      CREATE TABLE IF NOT EXISTS bookmarks (
        user_id TEXT NOT NULL,
        link_id TEXT NOT NULL,
        PRIMARY KEY(user_id, link_id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(link_id) REFERENCES links(id) ON DELETE CASCADE
      );
    `);
  }

  private bootstrapData(legacyJsonPath: string | null): void {
    const countRow = this.sqlite.prepare('SELECT COUNT(*) as cnt FROM categories').get() as { cnt: number };

    if (countRow.cnt === 0) {
      let migrated = false;
      if (legacyJsonPath && fs.existsSync(legacyJsonPath)) {
        try {
          const raw = fs.readFileSync(legacyJsonPath, 'utf-8');
          const legacy = JSON.parse(raw) as LegacyDatabaseSchema;
          if (legacy.categories && legacy.categories.length > 0) {
            this.importLegacyJson(legacy);
            migrated = true;
          }
        } catch (err) {
          console.error('Failed to migrate legacy JSON database, seeding fresh database:', err);
        }
      }
      if (!migrated) {
        this.seedFreshDatabase();
      }
    }

    // Ensure DIGITAL LINK HUB category exists alongside existing categories
    this.ensureDigitalLinkHubCategory();
    // Ensure owner_state row exists
    this.ensureOwnerStateRow();
  }

  private importLegacyJson(legacy: LegacyDatabaseSchema): void {
    const now = new Date().toISOString();
    this.sqlite.exec('BEGIN');
    try {
      const insertUser = this.sqlite.prepare(`
        INSERT OR IGNORE INTO users (id, username, email, password_hash, salt, role, created_at, is_active, invitation_code_used)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let ownerConfigured = false;
      let hasOwnerRecord = false;

      for (const u of legacy.users || []) {
        let passwordHash = u.passwordHash;
        let salt = u.salt;

        if (u.id === OWNER_USER_ID || u.role === 'admin') {
          hasOwnerRecord = true;
          // Invalidate legacy hardcoded template password so the owner creates their own private admin password
          if (verifyPassword('FluxAdmin#2026!', u.passwordHash, u.salt)) {
            const unconfigured = hashPassword(crypto.randomBytes(32).toString('hex'));
            passwordHash = unconfigured.hash;
            salt = unconfigured.salt;
            ownerConfigured = false;
          } else {
            ownerConfigured = true;
          }
        }

        insertUser.run(
          u.id,
          u.username,
          u.email,
          passwordHash,
          salt,
          u.role,
          u.createdAt || now,
          u.isActive ? 1 : 0,
          u.invitationCodeUsed ?? null
        );
      }

      if (!hasOwnerRecord) {
        const placeholder = hashPassword(crypto.randomBytes(32).toString('hex'));
        insertUser.run(
          OWNER_USER_ID,
          'omega_owner',
          'owner@ultramegaflux.internal',
          placeholder.hash,
          placeholder.salt,
          'admin',
          now,
          1,
          null
        );
      }

      this.sqlite
        .prepare(
          'INSERT OR REPLACE INTO owner_state (id, owner_user_id, is_configured, updated_at) VALUES (1, ?, ?, ?)'
        )
        .run(OWNER_USER_ID, ownerConfigured ? 1 : 0, now);

      const insertCode = this.sqlite.prepare(`
        INSERT OR IGNORE INTO invitation_codes (id, code, created_by_user_id, max_uses, times_used, is_active, created_at, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const c of legacy.invitationCodes || []) {
        insertCode.run(
          c.id,
          c.code,
          c.createdByUserId,
          c.maxUses || 0,
          c.timesUsed || 0,
          c.isActive ? 1 : 0,
          c.createdAt || now,
          c.note || ''
        );
      }

      const insertCat = this.sqlite.prepare(`
        INSERT OR IGNORE INTO categories (id, name, slug, description, icon, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const cat of legacy.categories || []) {
        insertCat.run(cat.id, cat.name, cat.slug, cat.description || '', cat.icon || 'Link', cat.order || 1);
      }

      const insertLink = this.sqlite.prepare(`
        INSERT OR IGNORE INTO links (id, title, url, category_id, description, tags_json, is_featured, click_count, created_at, updated_at, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const lnk of legacy.links || []) {
        insertLink.run(
          lnk.id,
          lnk.title,
          lnk.url,
          lnk.categoryId,
          lnk.description || '',
          JSON.stringify(lnk.tags || []),
          lnk.isFeatured ? 1 : 0,
          lnk.clickCount || 0,
          lnk.createdAt || now,
          lnk.updatedAt || now,
          lnk.createdByUserId || OWNER_USER_ID
        );
      }

      const insertBookmark = this.sqlite.prepare(`
        INSERT OR IGNORE INTO bookmarks (user_id, link_id) VALUES (?, ?)
      `);
      const bookmarks = legacy.bookmarks || {};
      for (const [userId, linkIds] of Object.entries(bookmarks)) {
        for (const linkId of linkIds || []) {
          insertBookmark.run(userId, linkId);
        }
      }

      this.sqlite.exec('COMMIT');
    } catch (err) {
      this.sqlite.exec('ROLLBACK');
      throw err;
    }
  }

  private seedFreshDatabase(): void {
    const now = new Date().toISOString();
    // Unconfigured owner account with unguessable random credential until owner sets their private password
    const ownerPlaceholder = hashPassword(crypto.randomBytes(32).toString('hex'));
    const demoMemberCreds = hashPassword(crypto.randomBytes(24).toString('hex'));

    this.sqlite.exec('BEGIN');
    try {
      const insertUser = this.sqlite.prepare(`
        INSERT INTO users (id, username, email, password_hash, salt, role, created_at, is_active, invitation_code_used)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertUser.run(
        OWNER_USER_ID,
        'omega_owner',
        'owner@ultramegaflux.internal',
        ownerPlaceholder.hash,
        ownerPlaceholder.salt,
        'admin',
        now,
        1,
        null
      );

      insertUser.run(
        'usr_member_demo',
        'cosmic_explorer',
        'explorer@flux.internal',
        demoMemberCreds.hash,
        demoMemberCreds.salt,
        'member',
        now,
        1,
        'FLUX-MEMBERSHIP-ALPHA'
      );

      this.sqlite
        .prepare('INSERT INTO owner_state (id, owner_user_id, is_configured, updated_at) VALUES (1, ?, 0, ?)')
        .run(OWNER_USER_ID, now);

      const insertCode = this.sqlite.prepare(`
        INSERT INTO invitation_codes (id, code, created_by_user_id, max_uses, times_used, is_active, created_at, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertCode.run('inv_1', 'FLUX-MEMBERSHIP-ALPHA', OWNER_USER_ID, 100, 1, 1, now, 'Primary Founding Member Invitation Code');
      insertCode.run('inv_2', 'OMEGA-COSMIC-PASS', OWNER_USER_ID, 50, 0, 1, now, 'Omega VIP Pass');
      insertCode.run('inv_3', 'NEXUS-777-ACCESS', OWNER_USER_ID, 25, 0, 1, now, 'Quantum Deep Access Key');

      const insertCat = this.sqlite.prepare(`
        INSERT INTO categories (id, name, slug, description, icon, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insertCat.run('cat_quantum', 'Quantum & Neural Intelligence', 'quantum-intelligence', 'Advanced computing substrates, neural networks, and synthetic reasoning systems.', 'Cpu', 1);
      insertCat.run('cat_cosmic', 'Deep Space & Astrometry', 'deep-space', 'Astronomical observatories, deep-field telemetry, and interstellar research portals.', 'Telescope', 2);
      insertCat.run('cat_bio', 'Bio-Cybernetics & Longevity', 'bio-cybernetics', 'Genomic engineering, cybernetic implants, and cellular longevity breakthroughs.', 'Dna', 3);
      insertCat.run('cat_decentral', 'Cryptographic Substrates', 'cryptographic-substrates', 'Zero-knowledge proofs, decentralized ledgers, and sovereign network infrastructure.', 'Shield', 4);
      insertCat.run('cat_physics', 'High-Energy Particle Physics', 'particle-physics', 'Collider datasets, quantum electrodynamics, and exotic matter explorations.', 'Atom', 5);

      const insertLink = this.sqlite.prepare(`
        INSERT INTO links (id, title, url, category_id, description, tags_json, is_featured, click_count, created_at, updated_at, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const dayMs = 86400000;
      insertLink.run(
        'lnk_jwst',
        'NASA James Webb Space Telescope Telemetry & Deep Field Explorer',
        'https://webbtelescope.org',
        'cat_cosmic',
        'Access the infrared observatory unveiling cosmic dawn, exoplanet atmospheres, and stellar nurseries.',
        JSON.stringify(['Infrared', 'Astrophysics', 'Deep Field', 'NASA']),
        1,
        142,
        new Date(Date.now() - dayMs * 5).toISOString(),
        new Date(Date.now() - dayMs * 5).toISOString(),
        OWNER_USER_ID
      );
      insertLink.run(
        'lnk_cern',
        'CERN Open Data Portal & Large Hadron Collider Datasets',
        'https://opendata.cern.ch',
        'cat_physics',
        'Petabytes of high-energy physics collision events from the ATLAS, CMS, ALICE, and LHCb experiments.',
        JSON.stringify(['High Energy', 'Particle Physics', 'LHC', 'Open Data']),
        1,
        98,
        new Date(Date.now() - dayMs * 4).toISOString(),
        new Date(Date.now() - dayMs * 4).toISOString(),
        OWNER_USER_ID
      );
      insertLink.run(
        'lnk_google_quantum',
        'Google Quantum AI & Cirq Quantum Computing Framework',
        'https://quantumai.google',
        'cat_quantum',
        'Leading quantum processor architectures, superconducting qubits, and open source quantum circuit synthesis.',
        JSON.stringify(['Superconducting', 'Qubits', 'Quantum Supremacy', 'Algorithms']),
        1,
        175,
        new Date(Date.now() - dayMs * 3).toISOString(),
        new Date(Date.now() - dayMs * 3).toISOString(),
        OWNER_USER_ID
      );
      insertLink.run(
        'lnk_eso_vlt',
        'European Southern Observatory (ESO) Science Archive',
        'https://archive.eso.org',
        'cat_cosmic',
        'Optical, submillimeter, and infrared astronomical observations from the Paranal and ALMA observatories.',
        JSON.stringify(['Observatory', 'Atacama', 'VLT', 'Astrometry']),
        0,
        64,
        new Date(Date.now() - dayMs * 2).toISOString(),
        new Date(Date.now() - dayMs * 2).toISOString(),
        OWNER_USER_ID
      );
      insertLink.run(
        'lnk_allen_brain',
        'Allen Institute Brain & Cell Science Atlas',
        'https://portal.brain-map.org',
        'cat_bio',
        'Comprehensive high-resolution cellular architectures, synaptic connectivity, and genomic mapping of neural circuits.',
        JSON.stringify(['Neuroscience', 'Cell Atlas', 'Synaptic Mapping', 'Bio-Cybernetics']),
        1,
        112,
        new Date(Date.now() - dayMs * 2).toISOString(),
        new Date(Date.now() - dayMs * 2).toISOString(),
        OWNER_USER_ID
      );
      insertLink.run(
        'lnk_zk_proofs',
        'Zero Knowledge Proofs (ZK-SNARK) Cryptographic Repository',
        'https://zkp.science',
        'cat_decentral',
        'Non-interactive zero-knowledge proofs, succinct arguments of knowledge, and privacy-preserving mathematical frameworks.',
        JSON.stringify(['Zero Knowledge', 'ZK-SNARKs', 'Cryptography', 'Verifiable Computing']),
        0,
        83,
        new Date(Date.now() - dayMs * 1).toISOString(),
        new Date(Date.now() - dayMs * 1).toISOString(),
        OWNER_USER_ID
      );
      insertLink.run(
        'lnk_arxiv_quant',
        'arXiv Quantum Physics & High Energy Physics Repository',
        'https://arxiv.org/archive/quant-ph',
        'cat_quantum',
        'Pre-print research repository covering quantum information theory, entanglement, and computational complexity.',
        JSON.stringify(['Academic', 'Preprints', 'Entanglement', 'Information Theory']),
        0,
        52,
        now,
        now,
        OWNER_USER_ID
      );

      this.sqlite
        .prepare('INSERT OR IGNORE INTO bookmarks (user_id, link_id) VALUES (?, ?)')
        .run('usr_member_demo', 'lnk_jwst');
      this.sqlite
        .prepare('INSERT OR IGNORE INTO bookmarks (user_id, link_id) VALUES (?, ?)')
        .run('usr_member_demo', 'lnk_google_quantum');

      this.sqlite.exec('COMMIT');
    } catch (err) {
      this.sqlite.exec('ROLLBACK');
      throw err;
    }
  }

  private ensureDigitalLinkHubCategory(): void {
    const existing = this.sqlite
      .prepare('SELECT id FROM categories WHERE id = ? OR slug = ?')
      .get(DIGITAL_HUB_CATEGORY_ID, 'digital-link-hub');

    if (!existing) {
      const maxRow = this.sqlite
        .prepare('SELECT COALESCE(MAX(sort_order), 5) as max_order FROM categories')
        .get() as { max_order: number };
      const order = Math.max(6, (maxRow.max_order || 5) + 1);

      this.sqlite.exec('BEGIN');
      try {
        this.sqlite
          .prepare(
            'INSERT INTO categories (id, name, slug, description, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .run(
            DIGITAL_HUB_CATEGORY_ID,
            'DIGITAL LINK HUB',
            'digital-link-hub',
            'Universal Social & Web Link Repository.',
            'Globe',
            order
          );

        const existingHubLinks = this.sqlite
          .prepare('SELECT COUNT(*) as cnt FROM links WHERE category_id = ?')
          .get(DIGITAL_HUB_CATEGORY_ID) as { cnt: number };

        if (existingHubLinks.cnt === 0) {
          const now = new Date().toISOString();
          const insertLink = this.sqlite.prepare(`
            INSERT INTO links (id, title, url, category_id, description, tags_json, is_featured, click_count, created_at, updated_at, created_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          insertLink.run(
            'lnk_hub_nasa_ig',
            'NASA Official Instagram',
            'https://www.instagram.com/nasa/',
            DIGITAL_HUB_CATEGORY_ID,
            'Deep-space photography, mission dispatches, and cosmic telemetry updates.',
            JSON.stringify(['Instagram', 'Social']),
            0,
            28,
            now,
            now,
            OWNER_USER_ID
          );
          insertLink.run(
            'lnk_hub_youtube_nasa',
            'NASA Live & Mission Streams on YouTube',
            'https://www.youtube.com/@NASA',
            DIGITAL_HUB_CATEGORY_ID,
            'Live orbital broadcasts, launch coverage, and astrophysics documentaries.',
            JSON.stringify(['YouTube', 'Video']),
            0,
            41,
            now,
            now,
            OWNER_USER_ID
          );
          insertLink.run(
            'lnk_hub_telegram',
            'Telegram Official Channel',
            'https://t.me/telegram',
            DIGITAL_HUB_CATEGORY_ID,
            'Encrypted broadcast channel for platform updates and release announcements.',
            JSON.stringify(['Telegram', 'Messaging']),
            0,
            19,
            now,
            now,
            OWNER_USER_ID
          );
        }
        this.sqlite.exec('COMMIT');
      } catch (err) {
        this.sqlite.exec('ROLLBACK');
        throw err;
      }
    }
  }

  private ensureOwnerStateRow(): void {
    const row = this.sqlite.prepare('SELECT id FROM owner_state WHERE id = 1').get();
    if (!row) {
      const now = new Date().toISOString();
      this.sqlite
        .prepare('INSERT INTO owner_state (id, owner_user_id, is_configured, updated_at) VALUES (1, ?, 0, ?)')
        .run(OWNER_USER_ID, now);
    }
  }

  // --- Owner / Private Admin Password Management ---

  public isOwnerConfigured(): boolean {
    const row = this.sqlite.prepare('SELECT is_configured FROM owner_state WHERE id = 1').get() as
      | { is_configured: number }
      | undefined;
    return row ? Number(row.is_configured) === 1 : false;
  }

  public getOwnerUser(): User | undefined {
    const state = this.sqlite.prepare('SELECT owner_user_id FROM owner_state WHERE id = 1').get() as
      | { owner_user_id: string }
      | undefined;
    const ownerId = state?.owner_user_id || OWNER_USER_ID;
    return this.findUserById(ownerId);
  }

  public setupOwnerPassword(
    password: string,
    customUsername?: string
  ): { success: boolean; user?: User; error?: string } {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const state = this.sqlite.prepare('SELECT is_configured, owner_user_id FROM owner_state WHERE id = 1').get() as
        | { is_configured: number; owner_user_id: string }
        | undefined;

      if (state && Number(state.is_configured) === 1) {
        this.sqlite.exec('ROLLBACK');
        return { success: false, error: 'Owner password is already configured. Please unlock Omega Control Center with your password.' };
      }

      const ownerId = state?.owner_user_id || OWNER_USER_ID;
      const now = new Date().toISOString();
      const { hash, salt } = hashPassword(password);
      const trimmedUsername = customUsername?.trim();

      if (trimmedUsername) {
        const conflict = this.sqlite
          .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?')
          .get(trimmedUsername, ownerId);
        if (conflict) {
          this.sqlite.exec('ROLLBACK');
          return { success: false, error: 'That username is already in use by another account.' };
        }
        this.sqlite
          .prepare('UPDATE users SET username = ?, password_hash = ?, salt = ?, is_active = 1 WHERE id = ?')
          .run(trimmedUsername, hash, salt, ownerId);
      } else {
        this.sqlite
          .prepare('UPDATE users SET password_hash = ?, salt = ?, is_active = 1 WHERE id = ?')
          .run(hash, salt, ownerId);
      }

      this.sqlite
        .prepare('INSERT OR REPLACE INTO owner_state (id, owner_user_id, is_configured, updated_at) VALUES (1, ?, 1, ?)')
        .run(ownerId, now);

      this.sqlite.exec('COMMIT');
      const owner = this.findUserById(ownerId);
      return { success: true, user: owner };
    } catch (err) {
      this.sqlite.exec('ROLLBACK');
      throw err;
    }
  }

  public verifyOwnerPassword(password: string): { valid: boolean; user?: User } {
    if (!this.isOwnerConfigured()) {
      return { valid: false };
    }
    const owner = this.getOwnerUser();
    if (!owner || !owner.isActive || owner.role !== 'admin') {
      return { valid: false };
    }
    const valid = verifyPassword(password, owner.passwordHash, owner.salt);
    return valid ? { valid: true, user: owner } : { valid: false };
  }

  public changeOwnerPassword(
    currentPassword: string,
    newPassword: string,
    keepSessionToken?: string
  ): { success: boolean; error?: string } {
    if (!this.isOwnerConfigured()) {
      return { success: false, error: 'Owner password has not been initialized yet.' };
    }
    const owner = this.getOwnerUser();
    if (!owner) {
      return { success: false, error: 'Owner account not found.' };
    }
    if (!verifyPassword(currentPassword, owner.passwordHash, owner.salt)) {
      return { success: false, error: 'Current admin password is incorrect.' };
    }

    const { hash, salt } = hashPassword(newPassword);
    const now = new Date().toISOString();

    this.sqlite.exec('BEGIN');
    try {
      this.sqlite
        .prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?')
        .run(hash, salt, owner.id);
      this.sqlite
        .prepare('UPDATE owner_state SET updated_at = ? WHERE id = 1')
        .run(now);

      if (keepSessionToken) {
        const keepHash = hashSessionToken(keepSessionToken);
        this.sqlite
          .prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?')
          .run(owner.id, keepHash);
      } else {
        this.sqlite.prepare('DELETE FROM sessions WHERE user_id = ?').run(owner.id);
      }

      this.sqlite.exec('COMMIT');
      return { success: true };
    } catch (err) {
      this.sqlite.exec('ROLLBACK');
      throw err;
    }
  }

  // --- Users & Auth ---

  public findUserById(id: string): User | undefined {
    const row = this.sqlite.prepare('SELECT * FROM users WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? mapUserRow(row) : undefined;
  }

  public findUserByUsername(username: string): User | undefined {
    const lower = username.trim().toLowerCase();
    const row = this.sqlite.prepare('SELECT * FROM users WHERE LOWER(username) = ?').get(lower) as
      | Record<string, unknown>
      | undefined;
    return row ? mapUserRow(row) : undefined;
  }

  public findUserByEmail(email: string): User | undefined {
    const lower = email.trim().toLowerCase();
    const row = this.sqlite.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(lower) as
      | Record<string, unknown>
      | undefined;
    return row ? mapUserRow(row) : undefined;
  }

  public findUserByUsernameOrEmail(identifier: string): User | undefined {
    const lower = identifier.trim().toLowerCase();
    const row = this.sqlite
      .prepare('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?')
      .get(lower, lower) as Record<string, unknown> | undefined;
    return row ? mapUserRow(row) : undefined;
  }

  public createUser(user: Omit<User, 'id' | 'createdAt'>): User {
    const id = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const createdAt = new Date().toISOString();
    this.sqlite
      .prepare(
        `INSERT INTO users (id, username, email, password_hash, salt, role, created_at, is_active, invitation_code_used)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        user.username,
        user.email,
        user.passwordHash,
        user.salt,
        user.role,
        createdAt,
        user.isActive ? 1 : 0,
        user.invitationCodeUsed ?? null
      );
    return { ...user, id, createdAt };
  }

  public registerMemberWithInvitation(params: {
    username: string;
    email: string;
    passwordHash: string;
    salt: string;
    invitationCode: string;
  }): { success: boolean; user?: User; error?: string; status?: number } {
    const normalizedCode = normalizeInviteCode(params.invitationCode);
    const now = new Date().toISOString();

    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const existingUsername = this.sqlite
        .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)')
        .get(params.username);
      if (existingUsername) {
        this.sqlite.exec('ROLLBACK');
        return {
          success: false,
          status: 409,
          error: 'Username is already taken in the ULTRA MEGA FLUX registry.',
        };
      }

      const existingEmail = this.sqlite
        .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)')
        .get(params.email);
      if (existingEmail) {
        this.sqlite.exec('ROLLBACK');
        return {
          success: false,
          status: 409,
          error: 'Email address is already registered.',
        };
      }

      const inviteRow = this.sqlite
        .prepare('SELECT * FROM invitation_codes WHERE UPPER(code) = ?')
        .get(normalizedCode) as Record<string, unknown> | undefined;

      if (!inviteRow) {
        this.sqlite.exec('ROLLBACK');
        return {
          success: false,
          status: 403,
          error: 'Invalid invitation code. Registration requires a verified ULTRA MEGA FLUX invitation key.',
        };
      }

      const invite = mapInvitationRow(inviteRow);
      if (!invite.isActive) {
        this.sqlite.exec('ROLLBACK');
        return {
          success: false,
          status: 403,
          error: 'This invitation code has been deactivated by administration.',
        };
      }

      if (invite.maxUses > 0 && invite.timesUsed >= invite.maxUses) {
        this.sqlite.exec('ROLLBACK');
        return {
          success: false,
          status: 403,
          error: 'This invitation code has reached its maximum allowable uses.',
        };
      }

      this.sqlite
        .prepare('UPDATE invitation_codes SET times_used = times_used + 1 WHERE id = ?')
        .run(invite.id);

      const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;
      this.sqlite
        .prepare(
          `INSERT INTO users (id, username, email, password_hash, salt, role, created_at, is_active, invitation_code_used)
           VALUES (?, ?, ?, ?, ?, 'member', ?, 1, ?)`
        )
        .run(
          userId,
          params.username,
          params.email,
          params.passwordHash,
          params.salt,
          now,
          normalizedCode
        );

      this.sqlite.exec('COMMIT');
      return {
        success: true,
        user: {
          id: userId,
          username: params.username,
          email: params.email,
          passwordHash: params.passwordHash,
          salt: params.salt,
          role: 'member',
          createdAt: now,
          isActive: true,
          invitationCodeUsed: normalizedCode,
        },
      };
    } catch (err) {
      this.sqlite.exec('ROLLBACK');
      throw err;
    }
  }

  public getAllUsers(): Omit<User, 'passwordHash' | 'salt'>[] {
    const rows = this.sqlite.prepare('SELECT * FROM users ORDER BY created_at ASC').all() as Record<
      string,
      unknown
    >[];
    return rows.map((r) => {
      const { passwordHash, salt, ...safe } = mapUserRow(r);
      return safe;
    });
  }

  public toggleUserActive(
    userId: string
  ): { success: boolean; user?: Omit<User, 'passwordHash' | 'salt'>; error?: string } {
    const user = this.findUserById(userId);
    if (!user) return { success: false, error: 'User not found' };
    if (user.role === 'admin' && user.id === OWNER_USER_ID) {
      return { success: false, error: 'Cannot deactivate website owner account' };
    }
    const nextActive = !user.isActive;
    this.sqlite.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(nextActive ? 1 : 0, userId);
    if (!nextActive) {
      this.sqlite.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    }
    const { passwordHash, salt, ...safeUser } = { ...user, isActive: nextActive };
    return { success: true, user: safeUser };
  }

  // --- Sessions (Token hashed via SHA-256 in DB) ---

  public createSession(userId: string, role: UserRole, durationHours = 72): Session {
    const now = new Date();
    const nowIso = now.toISOString();
    // Purge expired sessions
    this.sqlite.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso);

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();

    this.sqlite
      .prepare('INSERT INTO sessions (token_hash, user_id, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .run(tokenHash, userId, role, nowIso, expiresAt);

    return {
      token,
      userId,
      role,
      createdAt: nowIso,
      expiresAt,
    };
  }

  public getSession(token: string): Session | undefined {
    if (!token || typeof token !== 'string') return undefined;
    const tokenHash = hashSessionToken(token);
    const row = this.sqlite.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash) as
      | Record<string, unknown>
      | undefined;
    if (!row) return undefined;

    const expiresAt = String(row.expires_at);
    if (new Date(expiresAt) <= new Date()) {
      this.sqlite.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      return undefined;
    }

    return {
      token,
      userId: String(row.user_id),
      role: row.role === 'admin' ? 'admin' : 'member',
      createdAt: String(row.created_at),
      expiresAt,
    };
  }

  public deleteSession(token: string): void {
    if (!token) return;
    const tokenHash = hashSessionToken(token);
    this.sqlite.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }

  // --- Invitation Codes ---

  public findInvitationCode(code: string): InvitationCode | undefined {
    const normalized = normalizeInviteCode(code);
    const row = this.sqlite
      .prepare('SELECT * FROM invitation_codes WHERE UPPER(code) = ?')
      .get(normalized) as Record<string, unknown> | undefined;
    return row ? mapInvitationRow(row) : undefined;
  }

  public validateAndClaimInvitation(code: string): { valid: boolean; codeRecord?: InvitationCode; error?: string } {
    const normalized = normalizeInviteCode(code);
    const record = this.findInvitationCode(normalized);
    if (!record) {
      return {
        valid: false,
        error: 'Invalid invitation code. Registration requires a verified ULTRA MEGA FLUX invitation key.',
      };
    }
    if (!record.isActive) {
      return { valid: false, error: 'This invitation code has been deactivated by administration.' };
    }
    if (record.maxUses > 0 && record.timesUsed >= record.maxUses) {
      return { valid: false, error: 'This invitation code has reached its maximum allowable uses.' };
    }

    this.sqlite
      .prepare('UPDATE invitation_codes SET times_used = times_used + 1 WHERE id = ?')
      .run(record.id);
    return { valid: true, codeRecord: { ...record, timesUsed: record.timesUsed + 1 } };
  }

  public createInvitationCode(
    code: string,
    createdByUserId: string,
    maxUses = 10,
    note = ''
  ): { success: boolean; invitation?: InvitationCode; error?: string } {
    const normalized = normalizeInviteCode(code);
    if (!normalized || normalized.length < 4) {
      return { success: false, error: 'Invitation code must be at least 4 characters long.' };
    }
    if (this.findInvitationCode(normalized)) {
      return { success: false, error: 'Invitation code already exists.' };
    }

    const parsedMax = Number(maxUses);
    if (!Number.isFinite(parsedMax) || parsedMax < 0 || parsedMax > 100000) {
      return { success: false, error: 'Max uses must be between 0 (unlimited) and 100000.' };
    }

    const invitation: InvitationCode = {
      id: `inv_${crypto.randomBytes(6).toString('hex')}`,
      code: normalized,
      createdByUserId,
      maxUses: Math.floor(parsedMax),
      timesUsed: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      note: typeof note === 'string' ? note.trim().slice(0, 200) : '',
    };

    this.sqlite
      .prepare(
        `INSERT INTO invitation_codes (id, code, created_by_user_id, max_uses, times_used, is_active, created_at, note)
         VALUES (?, ?, ?, ?, 0, 1, ?, ?)`
      )
      .run(
        invitation.id,
        invitation.code,
        invitation.createdByUserId,
        invitation.maxUses,
        invitation.createdAt,
        invitation.note || ''
      );

    return { success: true, invitation };
  }

  public getInvitationCodes(): InvitationCode[] {
    const rows = this.sqlite
      .prepare('SELECT * FROM invitation_codes ORDER BY created_at DESC')
      .all() as Record<string, unknown>[];
    return rows.map(mapInvitationRow);
  }

  public toggleInvitationCode(id: string): { success: boolean; invitation?: InvitationCode; error?: string } {
    const row = this.sqlite.prepare('SELECT * FROM invitation_codes WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return { success: false, error: 'Invitation code not found' };
    const current = mapInvitationRow(row);
    const nextActive = !current.isActive;
    this.sqlite
      .prepare('UPDATE invitation_codes SET is_active = ? WHERE id = ?')
      .run(nextActive ? 1 : 0, id);
    return { success: true, invitation: { ...current, isActive: nextActive } };
  }

  public deleteInvitationCode(id: string): { success: boolean; error?: string } {
    const res = this.sqlite.prepare('DELETE FROM invitation_codes WHERE id = ?').run(id);
    if (res.changes === 0) return { success: false, error: 'Invitation code not found' };
    return { success: true };
  }

  // --- Categories ---

  public getCategories(): Category[] {
    const rows = this.sqlite.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all() as Record<
      string,
      unknown
    >[];
    return rows.map(mapCategoryRow);
  }

  public getCategoryById(id: string): Category | undefined {
    const row = this.sqlite.prepare('SELECT * FROM categories WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? mapCategoryRow(row) : undefined;
  }

  public createCategory(name: string, description: string, icon = 'Link', order?: number): Category {
    const cleanName = name.trim();
    const baseSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'sector';
    let slug = baseSlug;
    let suffix = 1;
    while (this.sqlite.prepare('SELECT id FROM categories WHERE slug = ?').get(slug)) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const maxRow = this.sqlite
      .prepare('SELECT COALESCE(MAX(sort_order), 0) as max_order FROM categories')
      .get() as { max_order: number };

    const newCategory: Category = {
      id: `cat_${crypto.randomBytes(6).toString('hex')}`,
      name: cleanName,
      slug,
      description: description.trim(),
      icon: icon || 'Link',
      order: typeof order === 'number' && Number.isFinite(order) ? order : (maxRow.max_order || 0) + 1,
    };

    this.sqlite
      .prepare(
        'INSERT INTO categories (id, name, slug, description, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(
        newCategory.id,
        newCategory.name,
        newCategory.slug,
        newCategory.description,
        newCategory.icon,
        newCategory.order
      );

    return newCategory;
  }

  public updateCategory(id: string, updates: Partial<Category>): Category | undefined {
    const existing = this.getCategoryById(id);
    if (!existing) return undefined;

    const nextName = typeof updates.name === 'string' && updates.name.trim() ? updates.name.trim() : existing.name;
    let nextSlug = existing.slug;
    if (nextName !== existing.name) {
      const baseSlug = nextName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'sector';
      nextSlug = baseSlug;
      let suffix = 1;
      while (
        this.sqlite.prepare('SELECT id FROM categories WHERE slug = ? AND id != ?').get(nextSlug, id)
      ) {
        nextSlug = `${baseSlug}-${suffix++}`;
      }
    }

    const nextDesc = typeof updates.description === 'string' ? updates.description.trim() : existing.description;
    const nextIcon = typeof updates.icon === 'string' && updates.icon.trim() ? updates.icon.trim() : existing.icon;
    const nextOrder =
      typeof updates.order === 'number' && Number.isFinite(updates.order) ? updates.order : existing.order;

    this.sqlite
      .prepare('UPDATE categories SET name = ?, slug = ?, description = ?, icon = ?, sort_order = ? WHERE id = ?')
      .run(nextName, nextSlug, nextDesc, nextIcon, nextOrder, id);

    return {
      id,
      name: nextName,
      slug: nextSlug,
      description: nextDesc,
      icon: nextIcon,
      order: nextOrder,
    };
  }

  public deleteCategory(id: string): { success: boolean; error?: string } {
    if (id === DIGITAL_HUB_CATEGORY_ID) {
      return { success: false, error: 'DIGITAL LINK HUB is a core system category and cannot be deleted.' };
    }
    const existing = this.getCategoryById(id);
    if (!existing) return { success: false, error: 'Category not found' };

    const countRow = this.sqlite
      .prepare('SELECT COUNT(*) as cnt FROM links WHERE category_id = ?')
      .get(id) as { cnt: number };
    if (countRow.cnt > 0) {
      return { success: false, error: `Cannot delete category: ${countRow.cnt} links are assigned to it.` };
    }

    this.sqlite.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return { success: true };
  }

  // --- Links ---

  public getLinks(options?: { categoryId?: string; search?: string; onlyFeatured?: boolean }): LinkItem[] {
    const clauses: string[] = [];
    const params: (string | number)[] = [];

    if (options?.categoryId && options.categoryId !== 'all') {
      clauses.push('category_id = ?');
      params.push(options.categoryId);
    }
    if (options?.onlyFeatured) {
      clauses.push('is_featured = 1');
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.sqlite
      .prepare(`SELECT * FROM links ${whereSql} ORDER BY is_featured DESC, created_at DESC`)
      .all(...params) as Record<string, unknown>[];

    let result = rows.map(mapLinkRow);

    if (options?.search && options.search.trim()) {
      const q = options.search.toLowerCase().trim();
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.url.toLowerCase().includes(q) ||
          l.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return result;
  }

  public getLinkById(id: string): LinkItem | undefined {
    const row = this.sqlite.prepare('SELECT * FROM links WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? mapLinkRow(row) : undefined;
  }

  public createLink(linkData: {
    title: string;
    url: string;
    categoryId: string;
    description: string;
    tags: string[];
    isFeatured: boolean;
    createdByUserId: string;
  }): LinkItem {
    const now = new Date().toISOString();
    const newLink: LinkItem = {
      id: `lnk_${crypto.randomBytes(7).toString('hex')}`,
      title: linkData.title.trim(),
      url: linkData.url.trim(),
      categoryId: linkData.categoryId,
      description: linkData.description.trim(),
      tags: linkData.tags.map((t) => t.trim()).filter(Boolean),
      isFeatured: !!linkData.isFeatured,
      clickCount: 0,
      createdAt: now,
      updatedAt: now,
      createdByUserId: linkData.createdByUserId,
    };

    this.sqlite
      .prepare(
        `INSERT INTO links (id, title, url, category_id, description, tags_json, is_featured, click_count, created_at, updated_at, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
      )
      .run(
        newLink.id,
        newLink.title,
        newLink.url,
        newLink.categoryId,
        newLink.description,
        JSON.stringify(newLink.tags),
        newLink.isFeatured ? 1 : 0,
        newLink.createdAt,
        newLink.updatedAt,
        newLink.createdByUserId
      );

    return newLink;
  }

  public updateLink(id: string, updates: Partial<LinkItem>): LinkItem | undefined {
    const existing = this.getLinkById(id);
    if (!existing) return undefined;

    const nextTitle = typeof updates.title === 'string' && updates.title.trim() ? updates.title.trim() : existing.title;
    const nextUrl = typeof updates.url === 'string' && updates.url.trim() ? updates.url.trim() : existing.url;
    const nextCat = typeof updates.categoryId === 'string' && updates.categoryId.trim() ? updates.categoryId : existing.categoryId;
    const nextDesc = typeof updates.description === 'string' ? updates.description.trim() : existing.description;
    const nextTags =
      updates.tags !== undefined ? updates.tags.map((t) => t.trim()).filter(Boolean) : existing.tags;
    const nextFeatured = updates.isFeatured !== undefined ? !!updates.isFeatured : existing.isFeatured;
    const updatedAt = new Date().toISOString();

    this.sqlite
      .prepare(
        `UPDATE links SET title = ?, url = ?, category_id = ?, description = ?, tags_json = ?, is_featured = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        nextTitle,
        nextUrl,
        nextCat,
        nextDesc,
        JSON.stringify(nextTags),
        nextFeatured ? 1 : 0,
        updatedAt,
        id
      );

    return {
      ...existing,
      title: nextTitle,
      url: nextUrl,
      categoryId: nextCat,
      description: nextDesc,
      tags: nextTags,
      isFeatured: nextFeatured,
      updatedAt,
    };
  }

  public deleteLink(id: string): boolean {
    const res = this.sqlite.prepare('DELETE FROM links WHERE id = ?').run(id);
    return res.changes > 0;
  }

  public recordLinkClick(id: string): number | null {
    const res = this.sqlite.prepare('UPDATE links SET click_count = click_count + 1 WHERE id = ?').run(id);
    if (res.changes === 0) return null;
    const row = this.sqlite.prepare('SELECT click_count FROM links WHERE id = ?').get(id) as
      | { click_count: number }
      | undefined;
    return row ? Number(row.click_count) : null;
  }

  // --- Bookmarks ---

  public getUserBookmarks(userId: string): string[] {
    const rows = this.sqlite.prepare('SELECT link_id FROM bookmarks WHERE user_id = ?').all(userId) as {
      link_id: string;
    }[];
    return rows.map((r) => r.link_id);
  }

  public toggleBookmark(userId: string, linkId: string): string[] {
    const existing = this.sqlite
      .prepare('SELECT 1 FROM bookmarks WHERE user_id = ? AND link_id = ?')
      .get(userId, linkId);
    if (existing) {
      this.sqlite.prepare('DELETE FROM bookmarks WHERE user_id = ? AND link_id = ?').run(userId, linkId);
    } else {
      this.sqlite.prepare('INSERT INTO bookmarks (user_id, link_id) VALUES (?, ?)').run(userId, linkId);
    }
    return this.getUserBookmarks(userId);
  }

  // --- Stats ---

  public getStats() {
    const linkStats = this.sqlite
      .prepare(
        `SELECT COUNT(*) as total_links,
                COALESCE(SUM(click_count), 0) as total_clicks,
                COALESCE(SUM(CASE WHEN is_featured = 1 THEN 1 ELSE 0 END), 0) as featured_count
         FROM links`
      )
      .get() as { total_links: number; total_clicks: number; featured_count: number };

    const catStats = this.sqlite.prepare('SELECT COUNT(*) as cnt FROM categories').get() as { cnt: number };
    const userStats = this.sqlite.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
    const invStats = this.sqlite
      .prepare('SELECT COUNT(*) as cnt FROM invitation_codes WHERE is_active = 1')
      .get() as { cnt: number };

    return {
      totalLinks: Number(linkStats.total_links || 0),
      totalCategories: Number(catStats.cnt || 0),
      totalMembers: Number(userStats.cnt || 0),
      activeInviteCodes: Number(invStats.cnt || 0),
      totalClicks: Number(linkStats.total_clicks || 0),
      featuredLinksCount: Number(linkStats.featured_count || 0),
    };
  }
}

export function createDatabase(dbPath?: string, legacyJsonPath?: string | null): FluxDatabase {
  return new FluxDatabase(dbPath, legacyJsonPath);
}

export const db = new FluxDatabase();
