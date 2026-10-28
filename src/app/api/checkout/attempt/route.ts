import { NextRequest, NextResponse } from 'next/server';
import { createBookingCheckoutAttempt } from '@/server/services/checkoutService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = createBookingCheckoutAttempt(body);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to initialize checkout attempt.' },
      { status: 500 }
    );
  }
}
