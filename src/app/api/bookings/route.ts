import { NextResponse } from 'next/server';
import { createCustomerBookingRequest } from '@/server/services/marketplaceService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = createCustomerBookingRequest(body);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create booking.' },
      { status: 500 }
    );
  }
}
