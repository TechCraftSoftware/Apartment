import { NextResponse } from 'next/server';
import { initializeBookingPayment } from '@/server/services/paystackService';
import { getAdminFromRequest } from '@/server/services/authService';
import {
  getVerifiedBookingBySessionToken,
  toGuestBooking,
} from '@/server/services/customerAndVerificationService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = new URL(request.url);
    const origin = `${url.protocol}//${url.host}`;

    // Paying against an existing booking requires proof of access to that
    // booking (guest access session) or an admin session.
    if (!body.checkoutAttemptId && body.bookingId && !getAdminFromRequest(request)) {
      const access = getVerifiedBookingBySessionToken(
        request.headers.get('x-booking-access-token') || undefined
      );
      if (!access.ok || access.rawBooking.id !== body.bookingId) {
        return NextResponse.json(
          { error: 'Booking access session required. Please verify your booking on /my-booking.' },
          { status: 401 }
        );
      }
    }

    const result = await initializeBookingPayment({
      checkoutAttemptId: body.checkoutAttemptId,
      bookingId: body.bookingId,
      paymentChoice: body.paymentChoice,
      paymentAmount:
        body.paymentAmount === undefined || body.paymentAmount === null || body.paymentAmount === ''
          ? undefined
          : Number(body.paymentAmount),
      callbackBaseUrl: body.callbackBaseUrl || origin,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ...result,
      booking: result.booking ? toGuestBooking(result.booking) : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to initialize Paystack payment.' },
      { status: 500 }
    );
  }
}
