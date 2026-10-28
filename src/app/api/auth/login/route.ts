import { NextResponse } from 'next/server';
import { loginAdminUser } from '@/server/services/authService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = loginAdminUser(body.email || '', body.password || '');

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const response = NextResponse.json({
      ok: true,
      user: result.user,
    });

    response.cookies.set('verdant_session_user', result.user.id, {
      httpOnly: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Login failed.' },
      { status: 500 }
    );
  }
}
