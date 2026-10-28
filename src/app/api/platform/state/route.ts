import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/server/services/authService';
import {
  addBlockedDateRange,
  createCustomerBookingRequest,
  createExternalBookingByAdmin,
  deleteApartmentListing,
  getFullPlatformState,
  getPublicPlatformState,
  pickPublicBookingInput,
  removeBlockedDateRange,
  reviewBankTransferReceipt,
  saveApartmentListing,
  updateBookingStatus,
} from '@/server/services/marketplaceService';
import { updateRealtorClientConfig } from '@/server/services/realtorConfigService';
import { adminReissueBookingVerificationCode } from '@/server/services/customerAndVerificationService';
import { resetDatabaseToSeed, withDatabaseTransaction, readDatabase } from '@/server/db/database';

export const dynamic = 'force-dynamic';

// Actions any visitor may perform. Everything else requires an admin session.
const PUBLIC_ACTIONS = new Set(['CREATE_BOOKING']);

export async function GET(request: Request) {
  try {
    const admin = getAdminFromRequest(request);
    const state = admin ? getFullPlatformState(admin.id) : getPublicPlatformState();
    return NextResponse.json(state, { headers: { 'Cache-Control': 'private, no-store' } });
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
    const admin = getAdminFromRequest(request);

    if (!admin && !PUBLIC_ACTIONS.has(body.action)) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to the Realtor Admin Dashboard.' },
        { status: 401 }
      );
    }

    // Only ever derived from the httpOnly admin session cookie.
    const actorUserId = admin ? admin.id : '';

    switch (body.action) {
      case 'CREATE_BOOKING': {
        const rawBooking = body.booking || body;
        const res = createCustomerBookingRequest(
          admin ? rawBooking : pickPublicBookingInput(rawBooking)
        );
        if (!res.ok) {
          return NextResponse.json({ error: res.error }, { status: res.status });
        }
        return NextResponse.json({
          ...res,
          state: admin ? getFullPlatformState(actorUserId) : getPublicPlatformState(),
        });
      }

      case 'CREATE_EXTERNAL_BOOKING': {
        const res = createExternalBookingByAdmin(actorUserId, body.booking || body);
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
        // Keep admin sessions so the operator stays signed in after the reset.
        const adminSessions = readDatabase().adminSessions;
        resetDatabaseToSeed();
        withDatabaseTransaction((db) => {
          db.adminSessions = adminSessions;
        });
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
