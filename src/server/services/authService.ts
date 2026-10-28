import crypto from 'crypto';
import { readDatabase, withDatabaseTransaction } from '@/server/db/database';
import { AdminUserRecord, UserRole } from '@/server/db/schema';

export const ADMIN_SESSION_COOKIE = 'verdant_admin_session';
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export interface PublicAdminProfile {
  id: string;
  clientId: string;
  email: string;
  name: string;
  fullName: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export function toPublicAdminProfile(user: AdminUserRecord): PublicAdminProfile {
  return {
    id: user.id,
    clientId: user.clientId,
    email: user.email,
    name: user.fullName,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export function getAdminById(userId: string | undefined): AdminUserRecord | undefined {
  if (!userId) return undefined;
  const db = readDatabase();
  return db.adminUsers.find((u) => u.id === userId && u.isActive);
}

function hashAdminSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(`verdant-admin-session:${rawToken}`).digest('hex');
}

/**
 * Issues an opaque random admin session token. Only its SHA-256 hash is
 * persisted; the raw token lives solely in the httpOnly session cookie.
 */
export function createAdminSession(userId: string): { token: string; expiresAt: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ADMIN_SESSION_TTL_SECONDS * 1000).toISOString();

  withDatabaseTransaction((db) => {
    db.adminSessions = db.adminSessions.filter((s) => new Date(s.expiresAt) > now);
    db.adminSessions.unshift({
      id: `admsess-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      tokenHash: hashAdminSessionToken(token),
      userId,
      expiresAt,
      createdAt: now.toISOString(),
    });
  });

  return { token, expiresAt };
}

export function revokeAdminSession(token: string | undefined): void {
  if (!token) return;
  const tokenHash = hashAdminSessionToken(token);
  withDatabaseTransaction((db) => {
    db.adminSessions = db.adminSessions.filter((s) => s.tokenHash !== tokenHash);
  });
}

export function getAdminBySessionToken(token: string | undefined): AdminUserRecord | undefined {
  if (!token) return undefined;
  const db = readDatabase();
  const tokenHash = hashAdminSessionToken(token);
  const now = new Date();
  const session = db.adminSessions.find(
    (s) => s.tokenHash === tokenHash && new Date(s.expiresAt) > now
  );
  if (!session) return undefined;
  return db.adminUsers.find((u) => u.id === session.userId && u.isActive);
}

export function extractAdminSessionToken(headers: Headers): string | undefined {
  const cookieHeader = headers.get('cookie');
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(/(?:^|;\s*)verdant_admin_session=([^;]+)/);
  return match && match[1] ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Resolves the signed-in Realtor Admin from the request's httpOnly session
 * cookie. Client-supplied user ids (headers, body, query) are never trusted.
 */
export function getAdminFromRequest(request: Request): AdminUserRecord | undefined {
  return getAdminBySessionToken(extractAdminSessionToken(request.headers));
}

export function requireRealtorAdmin(
  actorUserId: string | undefined
):
  | { ok: true; actor: AdminUserRecord }
  | { ok: false; error: string; status: 401 | 403 } {
  if (!actorUserId) {
    return {
      ok: false,
      error: 'Authentication required. Please sign in to the Realtor Admin Dashboard.',
      status: 401,
    };
  }
  const user = getAdminById(actorUserId);
  if (!user) {
    return {
      ok: false,
      error: 'Invalid or expired administrator session.',
      status: 401,
    };
  }
  if (user.role !== 'REALTOR_ADMIN') {
    return {
      ok: false,
      error: 'Forbidden: Realtor Administrator access required.',
      status: 403,
    };
  }
  return { ok: true, actor: user };
}

export function loginAdminUser(
  email: string,
  passwordPlain: string
):
  | { ok: true; user: PublicAdminProfile }
  | { ok: false; error: string; status: 400 | 401 | 403 } {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !passwordPlain) {
    return {
      ok: false,
      error: 'Email and password are required.',
      status: 400,
    };
  }

  const db = readDatabase();
  const matched = db.adminUsers.find(
    (u) => u.email.toLowerCase() === normalizedEmail
  );

  if (!matched || matched.passwordHash !== passwordPlain) {
    return {
      ok: false,
      error: 'Invalid administrator email or password credentials.',
      status: 401,
    };
  }

  if (!matched.isActive) {
    return {
      ok: false,
      error: 'This administrator account has been deactivated.',
      status: 403,
    };
  }

  return {
    ok: true,
    user: toPublicAdminProfile(matched),
  };
}
