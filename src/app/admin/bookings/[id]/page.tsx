'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Users,
  Mail,
  Phone,
  MapPin,
  Check,
  X,
  Ban,
  Clock,
  CheckCircle2,
  AlertCircle,
  CalendarRange,
  MessageSquare,
  KeyRound,
  CreditCard,
  RefreshCw,
  Landmark,
  FileText,
  FileCheck,
  FileX,
  ExternalLink,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import { BookingStatus, PaymentStatus } from '@/types';
import {
  BookingStatusBadge,
  PaymentStatusBadge,
  ReceiptStatusBadge,
} from '@/components/ui/BookingStatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { checkApartmentAvailability } from '@/lib/availability';
import {
  calculateNights,
  formatDisplayDate,
  formatNaira,
} from '@/lib/utils';
import { describePayment } from '@/lib/payments';

export default function AdminBookingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    bookings,
    apartments,
    blocks,
    payments,
    devVerificationCodes,
    updateBookingStatus,
    reissueVerificationCode,
    reviewBankTransferReceipt,
    recordOfflinePayment,
  } = useBookingContext();

  const bookingId = params?.id || '';
  const booking = bookings.find(
    (b) =>
      b.id === bookingId ||
      b.reference === bookingId ||
      b.bookingReference === bookingId
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [reissuingCode, setReissuingCode] = useState(false);
  const [reissuedCodePreview, setReissuedCodePreview] = useState<string | null>(
    null
  );
  const [isReviewingReceipt, setIsReviewingReceipt] = useState(false);
  const [rejectReceiptModalOpen, setRejectReceiptModalOpen] = useState(false);
  const [receiptRejectionReason, setReceiptRejectionReason] = useState('');
  const [recordAmount, setRecordAmount] = useState('');
  const [recordChannel, setRecordChannel] = useState<'cash' | 'pos' | 'bank_transfer'>('cash');
  const [recordNote, setRecordNote] = useState('');
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    targetStatus: BookingStatus;
  }>({
    isOpen: false,
    targetStatus: 'Cancelled',
  });

  if (!booking) {
    return (
      <div className="py-12">
        <EmptyState
          title="Reservation Record Not Found"
          description="The requested booking could not be found."
          actionLabel="Back to Bookings"
          onAction={() => router.push('/admin/bookings')}
        />
      </div>
    );
  }

  const apartment = apartments.find((a) => a.id === booking.apartmentId);
  const nights = calculateNights(booking.checkIn, booking.checkOut);
  const bookingPayments = payments.filter((p) => p.bookingId === booking.id);
  const pendingTransfer = bookingPayments.find(
    (p) => p.paymentMethod === 'BankTransfer' && p.receiptVerificationStatus === 'PendingReview'
  );
  const balanceDue =
    booking.balanceAmount ?? Math.max(0, booking.totalAmount - (booking.amountPaid || 0));
  const canRecordPayment =
    balanceDue > 0 && !['Cancelled', 'Rejected', 'Expired'].includes(booking.status);
  const activeDevCode =
    reissuedCodePreview ||
    devVerificationCodes[booking.reference] ||
    devVerificationCodes[booking.bookingReference];

  // Check if any OTHER active booking or block conflicts with this reservation
  const conflictCheck = checkApartmentAvailability(
    booking.apartmentId,
    booking.checkIn,
    booking.checkOut,
    bookings,
    blocks,
    {
      excludeBookingId: booking.id,
      ignorePastDateCheck: true,
    }
  );

  const handleApprove = async () => {
    setActionError(null);
    setActionMessage(null);

    // Payment conditions before confirming (mirrors the server rule)
    if (pendingTransfer || booking.receiptVerificationStatus === 'PendingReview') {
      setActionError(
        'A bank transfer receipt is waiting for review. Verify or reject it before confirming the booking.'
      );
      return;
    }
    if (booking.paymentStatus !== 'Paid' && booking.paymentStatus !== 'Partially Paid') {
      setActionError(
        'No payment has been received for this booking yet. Record or verify a payment before confirming.'
      );
      return;
    }

    const res = await updateBookingStatus(booking.id, 'Confirmed');
    if (!res.success && res.error) {
      setActionError(res.error);
    } else {
      setActionMessage(
        balanceDue > 0
          ? `Booking confirmed. The guest still owes ${formatNaira(balanceDue)}.`
          : 'Booking confirmed and dates locked on calendar.'
      );
    }
  };

  const handleVerifyReceipt = async () => {
    setIsReviewingReceipt(true);
    setActionError(null);
    setActionMessage(null);
    const res = await reviewBankTransferReceipt(booking.id, 'VERIFY');
    setIsReviewingReceipt(false);
    if (!res.success) {
      setActionError(res.error || 'Failed to verify transfer receipt.');
    } else {
      setActionMessage('Transfer verified and added to the amount paid.');
    }
  };

  const handleRejectReceipt = async () => {
    if (!receiptRejectionReason.trim()) {
      setActionError('Please provide a reason for rejecting the receipt.');
      return;
    }
    setIsReviewingReceipt(true);
    setActionError(null);
    setActionMessage(null);
    const res = await reviewBankTransferReceipt(
      booking.id,
      'REJECT',
      receiptRejectionReason.trim()
    );
    setIsReviewingReceipt(false);
    setRejectReceiptModalOpen(false);
    setReceiptRejectionReason('');
    if (!res.success) {
      setActionError(res.error || 'Failed to reject transfer receipt.');
    } else {
      setActionMessage('Bank transfer receipt rejected.');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionMessage(null);
    setIsRecordingPayment(true);
    const res = await recordOfflinePayment(
      booking.id,
      Number(recordAmount),
      recordChannel,
      recordNote.trim() || undefined
    );
    setIsRecordingPayment(false);
    if (!res.success) {
      setActionError(res.error || 'Could not record payment.');
      return;
    }
    setRecordAmount('');
    setRecordNote('');
    setActionMessage('Payment recorded.');
  };

  const handleMarkCompleted = async () => {
    setActionError(null);
    setActionMessage(null);
    const res = await updateBookingStatus(
      booking.id,
      'Completed',
      'Guest stay completed.'
    );
    if (!res.success && res.error) {
      setActionError(res.error);
    } else {
      setActionMessage('Reservation marked as Completed.');
    }
  };

  const handlePaymentStatusUpdate = async (nextPaymentStatus: PaymentStatus) => {
    setActionError(null);
    setActionMessage(null);
    const res = await updateBookingStatus(
      booking.id,
      booking.status,
      `Payment status updated to ${nextPaymentStatus} by Realtor Admin.`,
      nextPaymentStatus
    );
    if (!res.success && res.error) {
      setActionError(res.error);
    } else {
      setActionMessage(`Payment status updated to ${nextPaymentStatus}.`);
    }
  };

  const handleReissueCode = async () => {
    setReissuingCode(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await reissueVerificationCode(booking.id);
      if (!res.success) {
        setActionError(res.error || 'Could not re-issue verification code.');
      } else {
        if (res.devModeCodePreview) {
          setReissuedCodePreview(res.devModeCodePreview);
        }
        setActionMessage(
          `New booking access code generated and sent to ${booking.guestEmail}. The previous code no longer works.`
        );
      }
    } finally {
      setReissuingCode(false);
    }
  };

  const handleConfirmDialog = async (note?: string) => {
    setActionError(null);
    setActionMessage(null);
    const res = await updateBookingStatus(
      booking.id,
      dialogState.targetStatus,
      note
    );
    if (!res.success && res.error) {
      setActionError(res.error);
    }
    setDialogState({ isOpen: false, targetStatus: 'Cancelled' });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/bookings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-brand-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Bookings</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2.5 mt-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 font-mono">
              {booking.reference}
            </h1>
            <BookingStatusBadge status={booking.status} />
            <PaymentStatusBadge status={booking.paymentStatus || 'Unpaid'} />
            <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 text-[11px] font-semibold">
              {booking.paymentMethod === 'BankTransfer' ? 'Bank Transfer' : 'Paystack'}
            </span>
            {booking.paymentMethod === 'BankTransfer' && (
              <ReceiptStatusBadge
                status={booking.receiptVerificationStatus || 'PendingReview'}
              />
            )}
            {booking.source && booking.source !== 'ONLINE' && (
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold uppercase tracking-wider">
                Source: {booking.source}
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Submitted on {new Date(booking.createdAt).toLocaleString()} • Last
            updated {new Date(booking.updatedAt).toLocaleString()}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {(booking.status === 'Pending' || booking.status === 'PendingApproval') && (
            <>
              <button
                type="button"
                onClick={handleApprove}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Approve & Confirm Booking</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setDialogState({ isOpen: true, targetStatus: 'Rejected' })
                }
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Reject Request</span>
              </button>
            </>
          )}

          {booking.status === 'Confirmed' && (
            <>
              <button
                type="button"
                onClick={handleMarkCompleted}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Stay Completed</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setDialogState({ isOpen: true, targetStatus: 'Cancelled' })
                }
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                <Ban className="w-4 h-4" />
                <span>Cancel Confirmed Booking</span>
              </button>
            </>
          )}

          <Link
            href={`/admin/calendar?apartmentId=${booking.apartmentId}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs sm:text-sm font-semibold transition-colors"
          >
            <CalendarRange className="w-4 h-4 text-brand-700" />
            <span>View on Calendar</span>
          </Link>
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Action Could Not Be Completed</p>
            <p className="text-xs text-red-800 mt-0.5">{actionError}</p>
          </div>
        </div>
      )}

      {actionMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Reservation Updated</p>
            <p className="text-xs text-emerald-800 mt-0.5">{actionMessage}</p>
          </div>
        </div>
      )}

      {/* Availability Re-verification Banner for Pending Bookings */}
      {(booking.status === 'Pending' || booking.status === 'PendingApproval') && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm flex items-start gap-3 ${
            conflictCheck.isAvailable
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {conflictCheck.isAvailable ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-bold">
              {conflictCheck.isAvailable
                ? 'Availability Verified: Ready for Approval'
                : 'Availability Conflict Detected'}
            </p>
            <p className="text-xs mt-0.5">
              {conflictCheck.isAvailable
                ? `No other confirmed reservations or maintenance blocks overlap with ${formatDisplayDate(
                    booking.checkIn
                  )} – ${formatDisplayDate(booking.checkOut)}.`
                : conflictCheck.reason}
            </p>
          </div>
        </div>
      )}

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Guest Details, Stay Schedule, Payments, Status History */}
        <div className="lg:col-span-8 space-y-6">
          {/* Guest Information */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-stone-900 border-b border-stone-100 pb-3">
              Guest Contact Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-stone-500 block">Guest Name</span>
                <span className="font-bold text-stone-900 text-base">
                  {booking.guestName}
                </span>
              </div>

              <div>
                <span className="text-xs text-stone-500 block">
                  Party Size
                </span>
                <span className="font-semibold text-stone-900 inline-flex items-center gap-1.5 mt-0.5">
                  <Users className="w-4 h-4 text-brand-700" />
                  {booking.guestCount}{' '}
                  {booking.guestCount === 1 ? 'Guest' : 'Guests'}
                </span>
              </div>

              <div>
                <span className="text-xs text-stone-500 block">
                  Email Address
                </span>
                <a
                  href={`mailto:${booking.guestEmail}`}
                  className="font-medium text-brand-800 hover:underline inline-flex items-center gap-1.5 mt-0.5"
                >
                  <Mail className="w-4 h-4" />
                  {booking.guestEmail}
                </a>
              </div>

              <div>
                <span className="text-xs text-stone-500 block">
                  Phone Number
                </span>
                <a
                  href={`tel:${booking.guestPhone}`}
                  className="font-medium text-stone-900 hover:underline inline-flex items-center gap-1.5 mt-0.5"
                >
                  <Phone className="w-4 h-4 text-brand-700" />
                  {booking.guestPhone}
                </a>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5 mb-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-brand-700" />
                Special Requests / Arrival Notes
              </span>
              <p className="text-sm text-stone-700 bg-stone-50 p-3.5 rounded-xl border border-stone-200/70">
                {booking.specialRequests
                  ? booking.specialRequests
                  : 'No special requests submitted by the guest.'}
              </p>
            </div>
          </div>

          {/* Stay & Financial Breakdown */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <h2 className="text-base font-bold text-stone-900">
                Stay Dates & Financial Summary
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500">Payment Status:</span>
                <PaymentStatusBadge status={booking.paymentStatus || 'Unpaid'} />
                {(booking.amountPaid || 0) > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handlePaymentStatusUpdate(e.target.value as PaymentStatus);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg border border-stone-300 bg-stone-50 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
                  >
                    <option value="">Mark refund…</option>
                    <option value="Refunded">Refunded (full)</option>
                    <option value="Partially Refunded">Partially refunded</option>
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-sand-50 border border-stone-200/70">
                <span className="text-xs text-stone-500 block">
                  Check-In (Inclusive)
                </span>
                <span className="text-sm font-bold text-stone-900 flex items-center gap-1.5 mt-1">
                  <Calendar className="w-4 h-4 text-brand-700" />
                  {formatDisplayDate(booking.checkIn, true)}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-sand-50 border border-stone-200/70">
                <span className="text-xs text-stone-500 block">
                  Check-Out (Exclusive)
                </span>
                <span className="text-sm font-bold text-stone-900 flex items-center gap-1.5 mt-1">
                  <Calendar className="w-4 h-4 text-brand-700" />
                  {formatDisplayDate(booking.checkOut, true)}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-sand-50 border border-stone-200/70">
                <span className="text-xs text-stone-500 block">
                  Length of Stay
                </span>
                <span className="text-sm font-bold text-stone-900 block mt-1">
                  {nights} {nights === 1 ? 'Night' : 'Nights'}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 space-y-2 text-sm">
              <div className="flex items-center justify-between text-stone-600">
                <span>Nightly Rate</span>
                <span className="font-medium text-stone-900">
                  {formatNaira(booking.nightlyRate)} / night
                </span>
              </div>
              <div className="flex items-center justify-between text-stone-600">
                <span>Cleaning Fee</span>
                <span>{formatNaira(booking.cleaningFee || 0)}</span>
              </div>
              <div className="flex items-center justify-between text-stone-600">
                <span>Service Fee</span>
                <span>{formatNaira(booking.serviceFee || 0)}</span>
              </div>
              <div className="pt-2.5 border-t border-stone-200 flex items-baseline justify-between">
                <span className="font-bold text-stone-900">
                  Total Booking Amount
                </span>
                <span className="text-xl font-bold text-brand-900">
                  {formatNaira(booking.totalAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-emerald-700 font-semibold">
                  Amount Paid: {formatNaira(booking.amountPaid || 0)}
                </span>
                <span className="text-stone-600 font-semibold">
                  Balance Due:{' '}
                  {formatNaira(
                    booking.balanceAmount ??
                      Math.max(0, booking.totalAmount - (booking.amountPaid || 0))
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Transfer receipt waiting for review (any booking can have one) */}
          {pendingTransfer && (
            <div className="bg-white rounded-2xl border-2 border-amber-300 p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-amber-700" />
                  <h2 className="text-base font-bold text-stone-900">
                    Transfer Receipt Waiting for Review
                  </h2>
                </div>
                <ReceiptStatusBadge status="PendingReview" />
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-stone-500">Guest says they transferred</p>
                  <p className="text-xl font-bold text-stone-900">
                    {formatNaira(pendingTransfer.amount)}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Uploaded {new Date(pendingTransfer.createdAt).toLocaleString()} •{' '}
                    {describePayment(pendingTransfer).typeLabel}
                  </p>
                </div>
                {pendingTransfer.receiptStorageKey && (
                  <a
                    href={`/api/receipts/${pendingTransfer.receiptStorageKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-xs font-semibold transition-colors shadow-2xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View Receipt</span>
                  </a>
                )}
              </div>

              <p className="text-xs text-stone-600">
                Check your bank account for this amount before verifying. Verifying adds{' '}
                {formatNaira(pendingTransfer.amount)} to the amount paid.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={isReviewingReceipt}
                  onClick={handleVerifyReceipt}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>
                    {isReviewingReceipt
                      ? 'Processing...'
                      : `Verify ${formatNaira(pendingTransfer.amount)} Received`}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={isReviewingReceipt}
                  onClick={() => setRejectReceiptModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <FileX className="w-4 h-4" />
                  <span>Reject Receipt</span>
                </button>
              </div>
            </div>
          )}

          {/* Payment history: card, transfers and admin-recorded payments */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-brand-700" />
                Payment History
              </h2>
              <span className="text-xs text-stone-500">
                Paid {formatNaira(booking.amountPaid || 0)} of {formatNaira(booking.totalAmount)}
              </span>
            </div>

            {booking.receiptVerificationStatus === 'Rejected' && booking.rejectionReason && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900">
                <span className="font-bold block">Last receipt rejected:</span>
                <p className="mt-0.5">{booking.rejectionReason}</p>
              </div>
            )}

            {bookingPayments.length === 0 ? (
              <p className="text-xs text-stone-500 bg-stone-50 p-4 rounded-xl border border-stone-200/70">
                No payments have been made for this booking yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {bookingPayments.map((pay) => {
                  const { typeLabel, methodLabel } = describePayment(pay);
                  const statusLabel =
                    pay.receiptVerificationStatus === 'PendingReview'
                      ? 'Awaiting review'
                      : pay.status === 'Success'
                        ? 'Received'
                        : pay.status === 'Pending' || pay.status === 'Initiated'
                          ? 'Not completed'
                          : pay.status;
                  return (
                    <div
                      key={pay.id}
                      className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-stone-900">
                          {typeLabel} • {methodLabel}
                        </p>
                        <p className="text-stone-500 mt-0.5">
                          {new Date(pay.paidAt || pay.createdAt).toLocaleString()} •{' '}
                          <span className="font-mono">{pay.reference}</span>
                        </p>
                        {pay.receiptStorageKey && (
                          <a
                            href={`/api/receipts/${pay.receiptStorageKey}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-1 text-brand-800 font-semibold hover:underline"
                          >
                            <FileText className="w-3 h-3" />
                            View receipt
                          </a>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-stone-900 text-sm">
                          {formatNaira(pay.amount)}
                        </p>
                        <span
                          className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            pay.status === 'Success'
                              ? 'bg-emerald-100 text-emerald-800'
                              : pay.status === 'Failed' || pay.status === 'Rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {canRecordPayment && (
              <form
                onSubmit={handleRecordPayment}
                className="pt-4 border-t border-stone-100 space-y-3"
              >
                <div>
                  <p className="text-sm font-bold text-stone-900">Record a payment</p>
                  <p className="text-xs text-stone-500">
                    For money received outside the website (cash, POS, or a transfer you
                    confirmed directly). Balance due: {formatNaira(balanceDue)}.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="number"
                    min={1}
                    max={balanceDue}
                    step={1}
                    required
                    placeholder="Amount (₦)"
                    value={recordAmount}
                    onChange={(e) => setRecordAmount(e.target.value)}
                    className="px-3 py-2.5 rounded-xl border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-700"
                  />
                  <select
                    value={recordChannel}
                    onChange={(e) =>
                      setRecordChannel(e.target.value as 'cash' | 'pos' | 'bank_transfer')
                    }
                    className="px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-700"
                  >
                    <option value="cash">Cash</option>
                    <option value="pos">POS</option>
                    <option value="bank_transfer">Bank transfer</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    value={recordNote}
                    onChange={(e) => setRecordNote(e.target.value)}
                    className="px-3 py-2.5 rounded-xl border border-stone-300 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-700"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isRecordingPayment}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-800 hover:bg-brand-900 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isRecordingPayment ? 'Saving...' : 'Record Payment'}</span>
                </button>
              </form>
            )}
          </div>

          {/* Status History Log */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-stone-900 border-b border-stone-100 pb-3">
              Reservation Status History
            </h2>

            <ol className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
              {booking.statusHistory.map((entry, idx) => (
                <li key={idx} className="relative pl-9">
                  <span className="absolute left-1.5 top-1 w-3.5 h-3.5 rounded-full bg-brand-800 border-2 border-white shadow-2xs" />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <BookingStatusBadge status={entry.status} size="sm" />
                    <span className="text-xs text-stone-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {entry.note && (
                    <p className="text-xs text-stone-600 mt-1.5 bg-stone-50 p-2.5 rounded-xl border border-stone-200/70">
                      {entry.note}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Right Column: Customer Verification Code + Apartment Summary Card */}
        <div className="lg:col-span-4 space-y-6">
          {/* Code-Based Customer Access Management */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-800 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  Customer Booking Access
                </h3>
                <p className="text-[11px] text-stone-500">
                  Reusable code, emailed to the guest
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Customers do not need a password or account. They open{' '}
              <Link
                href="/my-booking"
                className="font-semibold text-brand-800 hover:underline"
              >
                /my-booking
              </Link>{' '}
              and enter the access code from their booking email. Re-issuing a
              code emails a new one and disables the old one.
            </p>

            {activeDevCode && (
              <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                  Development Mode Outbox Code
                </span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-lg font-mono font-bold tracking-widest text-amber-950">
                    {activeDevCode}
                  </span>
                  <Link
                    href={`/my-booking?code=${encodeURIComponent(activeDevCode)}`}
                    className="text-[11px] font-semibold text-brand-800 hover:underline"
                  >
                    Test in /my-booking →
                  </Link>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleReissueCode}
              disabled={reissuingCode}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${reissuingCode ? 'animate-spin' : ''}`}
              />
              <span>
                {reissuingCode
                  ? 'Generating Fresh Code...'
                  : 'Re-issue Fresh Verification Code'}
              </span>
            </button>
          </div>

          {apartment && (
            <div className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-xs">
              <div className="relative h-44 w-full bg-stone-200">
                <Image
                  src={apartment.images[0]}
                  alt={apartment.name}
                  fill
                  className="object-cover"
                  sizes="400px"
                />
              </div>
              <div className="p-5 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700">
                  {apartment.neighborhood}
                </span>
                <h3 className="text-base font-bold text-stone-900">
                  {apartment.name}
                </h3>
                <p className="text-xs text-stone-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-brand-700 shrink-0" />
                  {apartment.location}
                </p>
                <div className="pt-3 border-t border-stone-100 flex flex-col gap-2">
                  <Link
                    href={`/admin/apartments/${apartment.id}/edit`}
                    className="w-full py-2 px-3 rounded-xl border border-stone-200 hover:bg-stone-50 text-xs font-semibold text-stone-700 text-center transition-colors"
                  >
                    Edit Apartment Listing
                  </Link>
                  <Link
                    href={`/apartments/${apartment.id}`}
                    className="w-full py-2 px-3 rounded-xl border border-stone-200 hover:bg-stone-50 text-xs font-semibold text-brand-800 text-center transition-colors"
                  >
                    View Public Apartment Page
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog for Rejecting or Cancelling */}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        title={
          dialogState.targetStatus === 'Cancelled'
            ? `Cancel Confirmed Reservation (${booking.reference})?`
            : `Reject Booking Request (${booking.reference})?`
        }
        description={
          dialogState.targetStatus === 'Cancelled'
            ? `Cancelling ${booking.guestName}'s confirmed booking will release the dates (${formatDisplayDate(
                booking.checkIn
              )} – ${formatDisplayDate(
                booking.checkOut
              )}) so other customers can book them.`
            : `Rejecting ${booking.guestName}'s pending request will release the held dates (${formatDisplayDate(
                booking.checkIn
              )} – ${formatDisplayDate(booking.checkOut)}).`
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
          setDialogState({ isOpen: false, targetStatus: 'Cancelled' })
        }
      />

      {/* Reject Receipt Modal */}
      {rejectReceiptModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">
                Reject Bank Transfer Receipt
              </h3>
              <button
                type="button"
                onClick={() => setRejectReceiptModalOpen(false)}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-stone-600">
              Provide a clear reason for rejecting the receipt. The customer will see this explanation on /my-booking and can upload a corrected receipt.
            </p>
            <textarea
              rows={3}
              value={receiptRejectionReason}
              onChange={(e) => setReceiptRejectionReason(e.target.value)}
              placeholder="e.g., Transfer amount does not match booking total, or payment not found in bank statement."
              className="w-full rounded-xl border border-stone-300 p-3 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-500"
            />
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRejectReceiptModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isReviewingReceipt || !receiptRejectionReason.trim()}
                onClick={handleRejectReceipt}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                {isReviewingReceipt ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
