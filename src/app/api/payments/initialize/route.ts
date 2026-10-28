import { NextResponse } from 'next/server';
import { initializeBookingPayment } from '@/server/services/paystackService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = new URL(request.url);
    const origin = `${url.protocol}//${url.host}`;

    const result = await initializeBookingPayment({
      checkoutAttemptId: body.checkoutAttemptId,
      bookingId: body.bookingId,
      paymentChoice: body.paymentChoice,
      callbackBaseUrl: body.callbackBaseUrl || origin,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to initialize Paystack payment.' },
      { status: 500 }
    );
  }
}
