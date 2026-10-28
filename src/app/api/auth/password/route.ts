import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  changeAdminPassword,
  createAdminSession,
  getAdminFromRequest,
} from '@/server/services/authService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const admin = getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    }

    const body = await request.json();
    const result = changeAdminPassword(
      admin.id,
      String(body.currentPassword || ''),
      String(body.newPassword || '')
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // Every old session was revoked; keep this browser signed in with a new one.
    const session = createAdminSession(admin.id);
    const response = NextResponse.json({ ok: true, message: 'Password updated.' });
    response.cookies.set(ADMIN_SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    });
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not update password.' },
      { status: 500 }
    );
  }
}
