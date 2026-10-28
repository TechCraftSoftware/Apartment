import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSession,
  loginAdminUser,
} from '@/server/services/authService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = loginAdminUser(body.email || '', body.password || '');

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const session = createAdminSession(result.user.id);

    const response = NextResponse.json({
      ok: true,
      user: result.user,
    });

    response.cookies.set(ADMIN_SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    });
    // Remove the legacy cookie that carried the raw admin user id.
    response.cookies.delete('verdant_session_user');

    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Login failed.' },
      { status: 500 }
    );
  }
}
