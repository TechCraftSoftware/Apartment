import { NextResponse } from 'next/server';
import { getVerifiedBookingBySessionToken } from '@/server/services/customerAndVerificationService';
import { cancelBookingByVerifiedCustomer } from '@/server/services/marketplaceService';

export const dynamic = 'force-dynamic';

function extractSessionToken(request: Request): string | undefined {
  const headerToken = request.headers.get('x-booking-access-token');
  if (headerToken && headerToken.trim()) {
    return headerToken.trim();
  }

  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token');
  if (queryToken && queryToken.trim()) {
    return queryToken.trim();
  }

  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)verdant_booking_access_token=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return undefined;
}

export async function GET(request: Request) {
  try {
    const token = extractSessionToken(request);
    const result = getVerifiedBookingBySessionToken(token);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      booking: result.booking,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load verified booking.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = body.sessionToken || extractSessionToken(request);

    if (body.action === 'CANCEL_BOOKING') {
      const cancelRes = cancelBookingByVerifiedCustomer(token, body.reason);
      if (!cancelRes.ok) {
        return NextResponse.json({ error: cancelRes.error }, { status: cancelRes.status });
      }
      const refreshed = getVerifiedBookingBySessionToken(token);
      return NextResponse.json({
        ok: true,
        message: cancelRes.message,
        booking: refreshed.ok ? refreshed.booking : null,
      });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Action failed.' },
      { status: 500 }
    );
  }
}
