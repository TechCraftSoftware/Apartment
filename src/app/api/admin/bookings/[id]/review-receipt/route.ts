import { NextRequest, NextResponse } from 'next/server';
import { reviewBankTransferReceipt } from '@/server/services/marketplaceService';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const actorUserId =
      request.headers.get('x-actor-user-id') || body.actorUserId;

    const result = reviewBankTransferReceipt(
      actorUserId,
      id,
      body.action,
      body.rejectionReason
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to review bank transfer receipt.' },
      { status: 500 }
    );
  }
}
