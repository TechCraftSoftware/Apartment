'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Eye,
  Check,
  X,
  Ban,
  Calendar,
  Users,
} from 'lucide-react';
import { Apartment, Booking, BookingStatus } from '@/types';
import {
  BookingStatusBadge,
  PaymentStatusBadge,
  ReceiptStatusBadge,
} from '@/components/ui/BookingStatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  calculateNights,
  formatDisplayDate,
  formatNaira,
} from '@/lib/utils';
import { useBookingContext } from '@/context/BookingContext';

interface BookingTableProps {
  bookings: Booking[];
  apartments: Apartment[];
  compact?: boolean;
}

export function BookingTable({
  bookings,
  apartments,
  compact = false,
}: BookingTableProps) {
  const { updateBookingStatus } = useBookingContext();
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    booking: Booking | null;
    targetStatus: BookingStatus;
  }>({
    isOpen: false,
    booking: null,
    targetStatus: 'Cancelled',
  });

  const getApartmentName = (apartmentId: string) => {
    return (
      apartments.find((a) => a.id === apartmentId)?.name || 'Unknown Apartment'
    );
  };

  const handleDirectApprove = async (booking: Booking) => {
    if (booking.receiptVerificationStatus === 'PendingReview') {
      alert(
        'Cannot confirm yet: a bank transfer receipt is waiting for review. Open the booking to verify or reject it.'
      );
      return;
    }
    if (booking.paymentStatus !== 'Paid' && booking.paymentStatus !== 'Partially Paid') {
      alert(
        'Cannot confirm yet: no payment has been received. Open the booking to record or verify a payment.'
      );
      return;
    }
    const res = await updateBookingStatus(booking.id, 'Confirmed');
    if (!res.success && res.error) {
      alert(res.error);
    }
  };

  const openStatusDialog = (booking: Booking, targetStatus: BookingStatus) => {
    setDialogState({
      isOpen: true,
      booking,
      targetStatus,
    });
  };

  const handleConfirmDialog = (note?: string) => {
    if (!dialogState.booking) return;
    updateBookingStatus(
      dialogState.booking.id,
      dialogState.targetStatus,
      note
    );
    setDialogState({ isOpen: false, booking: null, targetStatus: 'Cancelled' });
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                <th className="py-3.5 px-4">Reference</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Apartment Unit</th>
                <th className="py-3.5 px-4">Stay Dates</th>
                {!compact && <th className="py-3.5 px-4">Guests</th>}
                <th className="py-3.5 px-4">Total / Paid</th>
                <th className="py-3.5 px-4">Booking Status</th>
                <th className="py-3.5 px-4">Payment Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200/70 text-sm">
              {bookings.map((bk) => {
                const nights = calculateNights(bk.checkIn, bk.checkOut);
                const ref = bk.bookingReference || bk.reference;
                const total = bk.totalPrice || bk.totalAmount;
                const paid = bk.amountPaid ?? 0;

                return (
                  <tr
                    key={bk.id}
                    className="hover:bg-stone-50/70 transition-colors"
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <Link
                        href={`/admin/bookings/${bk.id}`}
                        className="font-mono text-xs font-bold text-brand-800 hover:underline block"
                      >
                        {ref}
                      </Link>
                      {bk.source && bk.source !== 'ONLINE' && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-900">
                          {bk.source}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-stone-900">
                        {bk.guestName}
                      </div>
                      <div className="text-xs text-stone-500 truncate max-w-[180px]">
                        {bk.guestEmail}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-stone-800 line-clamp-1 max-w-[200px]">
                        {getApartmentName(bk.apartmentId)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-stone-900">
                        <Calendar className="w-3.5 h-3.5 text-brand-700 shrink-0" />
                        <span>
                          {formatDisplayDate(bk.checkIn)} →{' '}
                          {formatDisplayDate(bk.checkOut)}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5">
                        {nights} {nights === 1 ? 'night' : 'nights'}
                      </div>
                    </td>

                    {!compact && (
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs text-stone-700">
                          <Users className="w-3.5 h-3.5 text-stone-400" />
                          {bk.guestCount || bk.guests}
                        </span>
                      </td>
                    )}

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-semibold text-stone-900 block">
                        {formatNaira(total)}
                      </span>
                      {paid > 0 && (
                        <span className="text-[11px] text-emerald-700 font-medium">
                          Paid: {formatNaira(paid)}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <BookingStatusBadge status={bk.status} size="sm" />
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <PaymentStatusBadge
                          status={bk.paymentStatus || 'Unpaid'}
                          size="sm"
                        />
                        {bk.receiptVerificationStatus === 'PendingReview' && (
                          <ReceiptStatusBadge
                            status={bk.receiptVerificationStatus || 'PendingReview'}
                            size="sm"
                          />
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {(bk.status === 'Pending' || bk.status === 'PendingApproval') && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDirectApprove(bk)}
                              title="Approve & Confirm Booking"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Confirm</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openStatusDialog(bk, 'Rejected')}
                              title="Reject Booking Request"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}

                        {bk.status === 'Confirmed' && (
                          <button
                            type="button"
                            onClick={() => openStatusDialog(bk, 'Cancelled')}
                            title="Cancel Confirmed Reservation"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-stone-700 text-xs font-medium transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Cancel</span>
                          </button>
                        )}

                        <Link
                          href={`/admin/bookings/${bk.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 text-xs font-medium transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Details</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={dialogState.isOpen}
        title={
          dialogState.targetStatus === 'Cancelled'
            ? `Cancel Confirmed Reservation (${dialogState.booking?.reference})?`
            : `Reject Booking Request (${dialogState.booking?.reference})?`
        }
        description={
          dialogState.targetStatus === 'Cancelled'
            ? `Are you sure you want to cancel ${dialogState.booking?.guestName}'s confirmed stay (${formatDisplayDate(dialogState.booking?.checkIn || '')} – ${formatDisplayDate(dialogState.booking?.checkOut || '')})? These dates will be immediately released and made available on the public calendar.`
            : `Declining ${dialogState.booking?.guestName}'s pending booking request will release the held dates (${formatDisplayDate(dialogState.booking?.checkIn || '')} – ${formatDisplayDate(dialogState.booking?.checkOut || '')}) back to public availability.`
        }
        confirmLabel={
          dialogState.targetStatus === 'Cancelled'
            ? 'Yes, Cancel Reservation'
            : 'Reject Request'
        }
        variant={dialogState.targetStatus === 'Cancelled' ? 'danger' : 'warning'}
        showNoteInput
        onConfirm={handleConfirmDialog}
        onCancel={() =>
          setDialogState({
            isOpen: false,
            booking: null,
            targetStatus: 'Cancelled',
          })
        }
      />
    </>
  );
}
