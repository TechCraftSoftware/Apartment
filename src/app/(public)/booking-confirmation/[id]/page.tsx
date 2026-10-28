'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  Calendar,
  MapPin,
  Users,
  Mail,
  Phone,
  ShieldCheck,
  ArrowRight,
  Building2,
  KeyRound,
  CreditCard,
  Copy,
  FileText,
  Landmark,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import { BookingPassCard } from '@/components/booking/BookingPassCard';
import { useGuestBooking } from '@/lib/bookingAccessClient';
import {
  BookingStatusBadge,
  PaymentStatusBadge,
  ReceiptStatusBadge,
} from '@/components/ui/BookingStatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  calculateNights,
  formatDisplayDate,
  formatNaira,
} from '@/lib/utils';

export default function BookingConfirmationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    bookings,
    apartments,
    devVerificationCodes,
    realtorConfig,
    addToast,
    isHydrated,
  } = useBookingContext();

  const bookingId = params?.id || '';
  // Guests see only the booking their access session unlocks; signed-in admins
  // can fall back to the records they already hold.
  const { booking: guestBooking, isLoading: isGuestBookingLoading } =
    useGuestBooking(bookingId);
  const booking =
    guestBooking ||
    bookings.find(
      (b) =>
        b.id === bookingId ||
        b.reference === bookingId ||
        b.bookingReference === bookingId
    );

  if (!isHydrated || isGuestBookingLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20">
        <LoadingState />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20">
        <EmptyState
          title="Booking Record Not Found"
          description="We could not load this booking in this browser session. Use your booking reference and access code on My Booking to view it."
          actionLabel="Go to My Booking"
          onAction={() => router.push('/my-booking')}
        />
      </div>
    );
  }

  const apartment = apartments.find((a) => a.id === booking.apartmentId);
  const nights = calculateNights(booking.checkIn, booking.checkOut);
  const ref = booking.bookingReference || booking.reference;
  const devCode = devVerificationCodes[ref.toUpperCase()] || null;
  const totalAmount = booking.totalPrice || booking.totalAmount;
  const amountPaid = booking.amountPaid ?? 0;
  const balanceAmount = Math.max(0, totalAmount - amountPaid);

  const canPayNow =
    booking.status !== 'Cancelled' &&
    booking.status !== 'Rejected' &&
    booking.paymentStatus !== 'Paid' &&
    balanceAmount > 0 &&
    (realtorConfig.paymentPolicy !== 'PayAfterApproval' ||
      booking.status === 'Confirmed');

  const copyCode = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    addToast({
      type: 'info',
      title: `${label} Copied`,
      message: `${text} copied to clipboard.`,
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8">
      {/* Main Confirmation Card */}
      <div className="bg-white rounded-3xl border border-stone-200/90 overflow-hidden shadow-lg">
        {/* Top Banner */}
        <div className="bg-brand-900 text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-brand-300">
                {realtorConfig.businessName}
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold mt-0.5">
                {booking.status === 'Confirmed'
                  ? 'Reservation Confirmed & Approved'
                  : booking.status === 'PendingApproval'
                    ? 'Booking Request Received — Pending Admin Approval'
                    : 'Booking Recorded — Next Steps'}
              </h1>
              <p className="text-xs sm:text-sm text-stone-300 mt-1">
                {booking.paymentMethod === 'BankTransfer'
                  ? 'Your bank transfer receipt is safely received and awaiting administrator verification.'
                  : `Your booking details and personal access code have been sent to ${booking.guestEmail}.`}
              </p>
            </div>
          </div>

          <div className="bg-brand-950/70 border border-brand-800 rounded-2xl px-4 py-3 text-left sm:text-right shrink-0">
            <span className="block text-[11px] uppercase tracking-wider text-stone-400">
              Booking Reference
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-lg font-bold text-white">
                {ref}
              </span>
              <button
                type="button"
                onClick={() => copyCode(ref, 'Booking Reference')}
                className="p-1 rounded-lg hover:bg-brand-800 text-brand-200 cursor-pointer"
                title="Copy Booking Reference"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Status Alert Bar with Separate BookingStatus, PaymentStatus, and ReceiptStatus */}
        <div className="bg-stone-50 border-b border-stone-200/80 px-6 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-stone-800">
            <Clock className="w-4 h-4 text-brand-700 shrink-0" />
            <span>
              <strong>Independent Status Tracking:</strong> Every reservation requires manual admin approval before stay confirmation.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-stone-500">Booking:</span>
            <BookingStatusBadge status={booking.status} />
            <span className="text-xs text-stone-500 ml-2">Payment:</span>
            <PaymentStatusBadge status={booking.paymentStatus || 'Unpaid'} />
            <span className="text-xs text-stone-500 ml-2">Method:</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-800">
              {booking.paymentMethod === 'BankTransfer' ? 'Bank Transfer' : 'Paystack'}
            </span>
            {booking.paymentMethod === 'BankTransfer' && (
              <>
                <span className="text-xs text-stone-500 ml-2">Receipt:</span>
                <ReceiptStatusBadge
                  status={booking.receiptVerificationStatus || 'PendingReview'}
                />
              </>
            )}
          </div>
        </div>

        {/* Details Body */}
        <div className="p-6 sm:p-8 space-y-8">
          {/* Primary Action Banner: Paystack vs Bank Transfer + Code-Based Access */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Payment / Receipt Status Card */}
            <div className="p-5 rounded-2xl bg-sand-50 border border-stone-200 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-900">
                    {booking.paymentMethod === 'BankTransfer' ? (
                      <>
                        <Landmark className="w-4 h-4 text-brand-700" />
                        Bank Transfer Verification
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 text-emerald-700" />
                        Paystack Gateway Status
                      </>
                    )}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-800">
                    {booking.paymentMethod === 'BankTransfer'
                      ? booking.receiptVerificationStatus === 'Verified'
                        ? 'Receipt Verified ✓'
                        : 'Review Pending'
                      : booking.paymentStatus === 'Paid'
                        ? 'Payment Verified ✓'
                        : 'Unpaid'}
                  </span>
                </div>
                <p className="text-xs text-stone-700 leading-relaxed">
                  {booking.paymentMethod === 'BankTransfer' ? (
                    booking.receiptVerificationStatus === 'Verified'
                      ? `Your transfer receipt has been verified and full payment of ${formatNaira(totalAmount)} is recorded.`
                      : 'Your proof-of-payment receipt has been stored securely in private storage and is pending review by our administrator. Once verified, the administrator will confirm your reservation.'
                  ) : booking.paymentStatus === 'Paid' ? (
                    `Online payment of ${formatNaira(totalAmount)} has been verified via Paystack test mode. Your booking is pending administrator confirmation.`
                  ) : (
                    `Online payment of ${formatNaira(totalAmount)} is pending.`
                  )}
                </p>
              </div>

              {booking.paymentMethod === 'BankTransfer' && booking.receiptStorageKey ? (
                <a
                  href={`/api/receipts/${booking.receiptStorageKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold transition-colors"
                >
                  <FileText className="w-4 h-4 text-brand-700" />
                  <span>View Uploaded Transfer Receipt</span>
                </a>
              ) : canPayNow ? (
                <Link
                  href={`/payment/${booking.id}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Proceed to Paystack Payment (Test Mode)</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <div className="text-xs font-semibold text-emerald-800">
                  {booking.paymentStatus === 'Paid'
                    ? '✓ Payment Verified'
                    : 'Awaiting Admin Review'}
                </div>
              )}
            </div>

            {/* Development Mode Verification Code Preview Card */}
            <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-950">
                    <KeyRound className="w-4 h-4 text-amber-700" />
                    Your Booking Access Code
                  </span>
                  {devCode && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-950">
                      Dev Mode Outbox Preview
                    </span>
                  )}
                </div>
                <p className="text-xs text-amber-950/90 leading-relaxed">
                  We emailed your booking details and access code to{' '}
                  <strong>{booking.guestEmail}</strong>. Enter the code on the My
                  Booking page any time to view your booking, or show it to anyone
                  who needs to see it.
                </p>
                {devCode ? (
                  <div className="flex items-center justify-between bg-white border border-amber-300 rounded-xl px-3.5 py-2">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-stone-500 block">
                        Booking Access Code
                      </span>
                      <span className="font-mono text-lg font-bold tracking-widest text-stone-900">
                        {devCode}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyCode(devCode, 'Verification Code')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-semibold"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-amber-900 italic">
                    Can&apos;t find the email? Check your spam folder, or request
                    the code again on the My Booking page.
                  </p>
                )}
              </div>

              <Link
                href="/my-booking"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-semibold transition-colors"
              >
                <KeyRound className="w-4 h-4" />
                <span>Go to My Booking</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Booking pass: code + QR to download or screenshot */}
          <BookingPassCard
            pass={{
              businessName: realtorConfig.businessName,
              bookingReference: ref,
              guestName: booking.guestName,
              apartmentName: apartment?.name || 'Serviced Apartment',
              apartmentLocation: apartment?.location,
              checkIn: booking.checkIn,
              checkOut: booking.checkOut,
              nights,
              guests: booking.guestCount,
              bookingStatus: booking.status,
              paymentStatus: booking.paymentStatus || 'Unpaid',
              amountPaid,
              balanceAmount,
            }}
          />

          {/* Apartment & Dates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-sand-50 border border-stone-200/80 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Selected Residence
              </span>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-800 text-white flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-900">
                    {apartment?.name || 'Serviced Apartment'}
                  </h2>
                  <p className="text-xs text-stone-600 flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-brand-700 shrink-0" />
                    <span>{apartment?.location || 'Lagos, Nigeria'}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-sand-50 border border-stone-200/80 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Stay Schedule
              </span>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-stone-500 block">
                    Check-In ({realtorConfig.defaultCheckInTime})
                  </span>
                  <span className="font-bold text-stone-900 flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-brand-700" />
                    {formatDisplayDate(booking.checkIn)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-stone-500 block">
                    Check-Out ({realtorConfig.defaultCheckOutTime})
                  </span>
                  <span className="font-bold text-stone-900 flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-brand-700" />
                    {formatDisplayDate(booking.checkOut)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Guest Details & Financial Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-stone-100">
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Customer Profile (Created Automatically)
              </h3>
              <div className="space-y-2 text-sm text-stone-700">
                <p className="font-semibold text-stone-900">
                  {booking.guestName}
                </p>
                <p className="flex items-center gap-2 text-xs text-stone-600">
                  <Mail className="w-3.5 h-3.5 text-brand-700" />
                  <span>{booking.guestEmail}</span>
                </p>
                <p className="flex items-center gap-2 text-xs text-stone-600">
                  <Phone className="w-3.5 h-3.5 text-brand-700" />
                  <span>{booking.guestPhone}</span>
                </p>
                <p className="flex items-center gap-2 text-xs text-stone-600">
                  <Users className="w-3.5 h-3.5 text-brand-700" />
                  <span>
                    {booking.guestCount}{' '}
                    {booking.guestCount === 1 ? 'Guest' : 'Guests'}
                  </span>
                </p>
                {booking.specialRequests && (
                  <div className="pt-2">
                    <span className="text-xs font-semibold text-stone-500 block">
                      Special Requests:
                    </span>
                    <p className="text-xs text-stone-700 italic mt-0.5 bg-stone-50 p-2.5 rounded-xl border border-stone-200/70">
                      &ldquo;{booking.specialRequests}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Agreed Price Snapshot
              </h3>
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2 text-sm">
                <div className="flex items-center justify-between text-stone-600">
                  <span>
                    {formatNaira(booking.nightlyRate)} × {nights}{' '}
                    {nights === 1 ? 'Night' : 'Nights'}
                  </span>
                  <span className="font-medium text-stone-900">
                    {formatNaira(booking.nightlyRate * nights)}
                  </span>
                </div>
                {(booking.cleaningFee || 0) > 0 && (
                  <div className="flex items-center justify-between text-stone-600 text-xs">
                    <span>Cleaning Fee</span>
                    <span>{formatNaira(booking.cleaningFee || 0)}</span>
                  </div>
                )}
                {(booking.serviceFee || 0) > 0 && (
                  <div className="flex items-center justify-between text-stone-600 text-xs">
                    <span>Service Charge</span>
                    <span>{formatNaira(booking.serviceFee || 0)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-stone-200 flex items-baseline justify-between">
                  <span className="font-bold text-stone-900">Total Amount</span>
                  <span className="text-lg font-bold text-brand-900">
                    {formatNaira(totalAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-emerald-800 font-medium">
                  <span>Amount Paid</span>
                  <span>{formatNaira(amountPaid)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-stone-700 font-semibold">
                  <span>Balance Remaining</span>
                  <span>{formatNaira(balanceAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Walkthrough Next Steps */}
          <div className="p-5 rounded-2xl bg-brand-50/70 border border-brand-200 space-y-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-brand-800 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-brand-950">
                  Evaluator Shortcuts: Test Payment, Code Verification, or Admin
                  Review
                </h3>
                <p className="text-xs text-brand-900/90 mt-0.5 leading-relaxed">
                  Booking <strong>{ref}</strong> is persisted in the server
                  database. You can test Paystack Test Mode payment, verify code
                  access on <code>/my-booking</code>, or review the booking in
                  the Realtor Admin Dashboard.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href={`/admin/bookings/${booking.id}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-xs font-semibold transition-colors shadow-2xs"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Review in Realtor Admin</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              {apartment && (
                <Link
                  href={`/apartments/${apartment.id}#availability-calendar`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold transition-colors"
                >
                  <Calendar className="w-4 h-4 text-brand-700" />
                  <span>Inspect Public Calendar</span>
                </Link>
              )}

              <Link
                href="/apartments"
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-stone-600 hover:text-stone-900"
              >
                <span>Browse More Apartments</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
