import { NextResponse } from 'next/server';
import { verifyBookingPayment } from '@/server/services/paystackService';
import { deliverQueuedBookingEmails } from '@/server/services/emailService';
import {
  issueBookingAccessSession,
  toGuestBooking,
} from '@/server/services/customerAndVerificationService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await verifyBookingPayment({
      reference: body.reference || '',
      expectedBookingId: body.bookingId || body.expectedBookingId,
      expectedCheckoutId: body.checkoutId || body.expectedCheckoutId,
      simulatedOutcome: body.simulatedOutcome,
      simulatedChannel: body.simulatedChannel,
      channel: body.channel,
    });
    await deliverQueuedBookingEmails();

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // The first successful verification hands the payer a short-lived booking
    // access session so confirmation/payment pages can load just this booking.
    // Idempotent replays don't mint new sessions.
    const access =
      !result.idempotentReplay && result.payment.status === 'Success'
        ? issueBookingAccessSession(result.booking.id)
        : null;

    return NextResponse.json({
      ...result,
      booking: toGuestBooking(result.booking),
      bookingAccessToken: access?.sessionToken ?? null,
      bookingAccessExpiresAt: access?.sessionExpiresAt ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Payment verification failed.' },
      { status: 500 }
    );
  }
}
