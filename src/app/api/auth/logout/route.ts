import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  extractAdminSessionToken,
  revokeAdminSession,
} from '@/server/services/authService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    revokeAdminSession(extractAdminSessionToken(request.headers));
  } catch {
    // Clearing the cookie below still signs the browser out.
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  response.cookies.delete('verdant_session_user');
  return response;
}
