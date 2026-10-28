import { NextResponse } from 'next/server';
import { verifyBookingAccessCode } from '@/server/services/customerAndVerificationService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'local-client';
    const rateLimitKey = `${clientIp}:${(body.bookingReference || 'any').toUpperCase()}`;

    const result = verifyBookingAccessCode({
      verificationCode: body.verificationCode || body.code || '',
      bookingReference: body.bookingReference,
      rateLimitKey,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status }
      );
    }

    const response = NextResponse.json({
      ok: true,
      sessionToken: result.sessionToken,
      sessionExpiresAt: result.sessionExpiresAt,
      booking: result.booking,
    });

    response.cookies.set('verdant_booking_access_token', result.sessionToken, {
      httpOnly: false,
      path: '/',
      maxAge: 60 * 30, // 30 minutes
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification failed.' },
      { status: 500 }
    );
  }
}
