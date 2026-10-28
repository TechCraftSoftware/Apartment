import { NextRequest, NextResponse } from 'next/server';
import { uploadBankTransferReceipt } from '@/server/services/checkoutService';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const checkoutId = formData.get('checkoutId') as string;
      const file = formData.get('file') as File;
      const uploaderEmail = formData.get('uploaderEmail') as string | undefined;

      if (!checkoutId || !file) {
        return NextResponse.json(
          { error: 'checkoutId and file are required.' },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const base64Data = buffer.toString('base64');

      const result = uploadBankTransferReceipt({
        checkoutId,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        base64Data,
        uploaderEmail,
      });

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status }
        );
      }

      return NextResponse.json(result);
    } else {
      // JSON payload
      const body = await request.json();
      const result = uploadBankTransferReceipt(body);

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status }
        );
      }

      return NextResponse.json(result);
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to upload receipt.' },
      { status: 500 }
    );
  }
}
