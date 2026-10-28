import { NextRequest, NextResponse } from 'next/server';
import { getPublicAvailabilityPayload } from '@/server/services/marketplaceService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const apartmentId =
    request.nextUrl.searchParams.get('apartmentId') || undefined;
  const payload = getPublicAvailabilityPayload(apartmentId);
  return NextResponse.json(payload);
}
