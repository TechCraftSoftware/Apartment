import { NextResponse } from 'next/server';
import { extractAdminIdFromHeaders } from '@/server/services/authService';
import {
  addBlockedDateRange,
  createCustomerBookingRequest,
  createExternalBookingByAdmin,
  deleteApartmentListing,
  getFullPlatformState,
  removeBlockedDateRange,
  reviewBankTransferReceipt,
  saveApartmentListing,
  updateBookingStatus,
} from '@/server/services/marketplaceService';
import { updateRealtorClientConfig } from '@/server/services/realtorConfigService';
import { adminReissueBookingVerificationCode } from '@/server/services/customerAndVerificationService';
import { resetDatabaseToSeed } from '@/server/db/database';
import { deliverQueuedBookingEmails } from '@/server/services/emailService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const actorUserId = extractAdminIdFromHeaders(request.headers);
    const state = getFullPlatformState(actorUserId);
    return NextResponse.json(state);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load platform state.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const actorUserId =
      body.actorUserId ||
      extractAdminIdFromHeaders(request.headers) ||
      'usr-realtor-admin-1';

    switch (body.action) {
      case 'CREATE_BOOKING': {
        const res = createCustomerBookingRequest(body.booking || body);
        await deliverQueuedBookingEmails();
        if (!res.ok) {
          return NextResponse.json({ error: res.error }, { status: res.status });
        }
        return NextResponse.json({
          ...res,
          state: getFullPlatformState(actorUserId),
        });
      }

      case 'CREATE_EXTERNAL_BOOKING': {
        const res = createExternalBookingByAdmin(actorUserId, body.booking || body);
        await deliverQueuedBookingEmails();
        if (!res.ok) {
          return NextResponse.json({ error: res.error }, { status: res.status });
        }
        return NextResponse.json({
          ...res,
          state: getFullPlatformState(actorUserId),
        });
      }

      case 'UPDATE_BOOKING_STATUS': {
        const res = updateBookingStatus(
          actorUserId,
          body.bookingId,
          body.status,
          body.adminNotes,
          body.paymentStatus
        );
        await deliverQueuedBookingEmails();
        if (!res.ok) {
          return NextResponse.json({ error: res.error }, { status: res.status });
        }
        return NextResponse.json({
          ...res,
          state: getFullPlatformState(actorUserId),
        });
      }

      case 'REVIEW_TRANSFER_RECEIPT': {
        const res = reviewBankTransferReceipt(
          actorUserId,
          body.bookingId,
          body.reviewAction || body.actionType,
          body.rejectionReason
        );
        if (!res.ok) {
          return NextResponse.json({ error: res.error }, { status: res.status });
        }
        return NextResponse.json({
          ...res,
          state: getFullPlatformState(actorUserId),
        });
      }

      case 'REISSUE_VERIFICATION_CODE': {
        const res = adminReissueBookingVerificationCode(actorUserId, body.bookingId);
        await deliverQueuedBookingEmails();
        if (!res.ok) {
          return NextResponse.json({ error: res.error }, { status: res.status });
        }
        return NextResponse.json({
          ...res,
          state: getFullPlatformState(actorUserId),
        });
      }

      case 'SAVE_APARTMENT': {
        const res = saveApartmentListing(actorUserId, body.apartment);
        if (!res.ok) {
          return NextResponse.json({ error: res.error }, { status: res.status });
        }
        return NextResponse.json({
          ...res,
          state: getFullPlatformState(actorUserId),
        });
      }

      case 'DELETE_APARTMENT': {
        const res = deleteApartmentListing(actorUserId, body.apartmentId);
        if (!res.ok) {
          return NextResponse.json({ error: res.error }, { status: res.status });
        }
        return NextResponse.json({
          ...res,
          state: getFullPlatformState(actorUserId),
        });
      }

      case 'ADD_BLOCKED_DATE': {
        const res = addBlockedDateRange(actorUserId, body.blockedDate);
        if (!res.ok) {
          return NextResponse.json({ error: res.error }, { status: res.status });
        }
        return NextResponse.json({
          ...res,
          state: getFullPlatformState(actorUserId),
        });
      }

      case 'REMOVE_BLOCKED_DATE': {
        const res = removeBlockedDateRange(actorUserId, body.blockId);
        if (!res.ok) {
          return NextResponse.json({ error: res.error }, { status: res.status });
        }
        return NextResponse.json({
          ...res,
          state: getFullPlatformState(actorUserId),
        });
      }

      case 'UPDATE_REALTOR_CONFIG': {
        const res = updateRealtorClientConfig(actorUserId, body.config || {});
        if (!res.ok) {
          return NextResponse.json({ error: res.error }, { status: res.status });
        }
        return NextResponse.json({
          ...res,
          state: getFullPlatformState(actorUserId),
        });
      }

      case 'RESET_DEMO_DATA': {
        resetDatabaseToSeed();
        return NextResponse.json({
          ok: true,
          message: 'Database reset to default Single-Client Realtor seed state.',
          state: getFullPlatformState(actorUserId),
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown platform action: ${body.action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Operation failed.' },
      { status: 500 }
    );
  }
}
