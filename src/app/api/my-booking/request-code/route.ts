import { NextResponse } from 'next/server';
import { requestFreshBookingVerificationCode } from '@/server/services/customerAndVerificationService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = requestFreshBookingVerificationCode({
      bookingReference: body.bookingReference || '',
      emailOrPhone: body.emailOrPhone || body.contact || '',
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to request verification code.' },
      { status: 500 }
    );
  }
}
