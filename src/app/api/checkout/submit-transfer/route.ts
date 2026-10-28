import { NextRequest, NextResponse } from 'next/server';
import { submitBankTransferCheckout } from '@/server/services/checkoutService';
import { deliverQueuedBookingEmails } from '@/server/services/emailService';
import {
  issueBookingAccessSession,
  toGuestBooking,
} from '@/server/services/customerAndVerificationService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = submitBankTransferCheckout(body);
    await deliverQueuedBookingEmails();

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, conflict: (result as any).conflict },
        { status: result.status }
      );
    }

    const access =
      !result.idempotentReplay && result.booking
        ? issueBookingAccessSession(result.booking.id)
        : null;

    return NextResponse.json({
      ...result,
      booking: result.booking ? toGuestBooking(result.booking) : result.booking,
      bookingAccessToken: access?.sessionToken ?? null,
      bookingAccessExpiresAt: access?.sessionExpiresAt ?? null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to submit bank transfer booking.' },
      { status: 500 }
    );
  }
}
