import { NextRequest, NextResponse } from 'next/server';
import { reviewBankTransferReceipt } from '@/server/services/marketplaceService';
import { getAdminFromRequest } from '@/server/services/authService';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const admin = getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to the Realtor Admin Dashboard.' },
        { status: 401 }
      );
    }

    const result = reviewBankTransferReceipt(
      admin.id,
      id,
      body.reviewAction || body.action,
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
