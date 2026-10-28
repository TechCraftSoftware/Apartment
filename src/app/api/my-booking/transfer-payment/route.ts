import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/server/services/authService';
import { submitBookingTransferPayment } from '@/server/services/checkoutService';
import {
  getVerifiedBookingBySessionToken,
  toGuestBooking,
} from '@/server/services/customerAndVerificationService';

export const dynamic = 'force-dynamic';

/**
 * Guest pays (part of) their balance by bank transfer: multipart form with
 * `bookingId`, `amount` (NGN, optional = full balance) and `receipt` file.
 * Requires the guest's booking access session (or an admin session).
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const bookingId = String(formData.get('bookingId') || '');
    const file = formData.get('receipt') as File | null;
    const rawAmount = formData.get('amount');

    if (!bookingId || !file) {
      return NextResponse.json(
        { error: 'Booking and receipt file are required.' },
        { status: 400 }
      );
    }

    if (!getAdminFromRequest(request)) {
      const access = getVerifiedBookingBySessionToken(
        request.headers.get('x-booking-access-token') || undefined
      );
      if (!access.ok || access.rawBooking.id !== bookingId) {
        return NextResponse.json(
          { error: 'Booking access session required. Please verify your booking on My Booking.' },
          { status: 401 }
        );
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = submitBookingTransferPayment({
      bookingId,
      transferAmount: rawAmount === null || rawAmount === '' ? undefined : Number(rawAmount),
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      base64Data: buffer.toString('base64'),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      message: result.message,
      booking: toGuestBooking(result.booking),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to submit transfer receipt.' },
      { status: 500 }
    );
  }
}
