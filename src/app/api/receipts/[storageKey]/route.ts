import { NextRequest, NextResponse } from 'next/server';
import { getPrivateReceiptRecord } from '@/server/services/checkoutService';
import { getAdminFromRequest } from '@/server/services/authService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storageKey: string }> }
) {
  try {
    const { storageKey } = await params;
    const actorUserId = getAdminFromRequest(request)?.id;
    const sessionToken =
      request.headers.get('x-booking-access-token') ||
      request.headers.get('x-booking-session-token') ||
      request.nextUrl.searchParams.get('sessionToken') ||
      request.nextUrl.searchParams.get('token') ||
      undefined;

    const result = getPrivateReceiptRecord(storageKey, {
      actorUserId,
      sessionToken,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const { receipt } = result;
    const fileBuffer = Buffer.from(receipt.base64Data, 'base64');

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': receipt.mimeType,
        'Content-Length': fileBuffer.length.toString(),
        'Content-Disposition': `inline; filename="${receipt.originalFilename}"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error retrieving receipt.' },
      { status: 500 }
    );
  }
}
