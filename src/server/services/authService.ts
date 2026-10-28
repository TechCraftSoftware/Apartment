import { readDatabase } from '@/server/db/database';
import { AdminUserRecord, UserRole } from '@/server/db/schema';

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

export function extractAdminIdFromHeaders(headers: Headers): string | undefined {
  const headerUserId = headers.get('x-platform-user-id');
  if (headerUserId && headerUserId.trim()) {
    return headerUserId.trim();
  }

  const cookieHeader = headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)verdant_session_user=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return undefined;
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
