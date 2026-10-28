import { NextResponse } from 'next/server';
import { verifyBookingPayment } from '@/server/services/paystackService';
import { deliverQueuedBookingEmails } from '@/server/services/emailService';

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

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Payment verification failed.' },
      { status: 500 }
    );
  }
}
