import React from 'react';
import { BookingStatus, PaymentStatus, ReceiptVerificationStatus } from '@/types';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  Award,
  AlertCircle,
  CreditCard,
  RotateCcw,
  FileCheck,
  FileClock,
  FileX,
} from 'lucide-react';

interface BookingStatusBadgeProps {
  status: BookingStatus;
  size?: 'sm' | 'md';
}

export function BookingStatusBadge({
  status,
  size = 'md',
}: BookingStatusBadgeProps) {
  const styles: Record<BookingStatus, string> = {
    PendingApproval: 'bg-amber-50 text-amber-900 border-amber-300 font-semibold',
    Pending: 'bg-amber-50 text-amber-800 border-amber-200',
    Confirmed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    Cancelled: 'bg-stone-100 text-stone-700 border-stone-200',
    Rejected: 'bg-red-50 text-red-800 border-red-200',
    Completed: 'bg-teal-50 text-teal-800 border-teal-200',
    Expired: 'bg-stone-100 text-stone-500 border-stone-200',
  };

  const icons: Record<BookingStatus, React.ReactNode> = {
    PendingApproval: <Clock className="w-3.5 h-3.5 text-amber-700" />,
    Pending: <Clock className="w-3.5 h-3.5 text-amber-600" />,
    Confirmed: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
    Cancelled: <Ban className="w-3.5 h-3.5 text-stone-500" />,
    Rejected: <XCircle className="w-3.5 h-3.5 text-red-600" />,
    Completed: <Award className="w-3.5 h-3.5 text-teal-600" />,
    Expired: <AlertCircle className="w-3.5 h-3.5 text-stone-400" />,
  };

  const labels: Record<BookingStatus, string> = {
    PendingApproval: 'Pending Approval',
    Pending: 'Pending',
    Confirmed: 'Confirmed',
    Cancelled: 'Cancelled',
    Rejected: 'Rejected',
    Completed: 'Completed',
    Expired: 'Expired',
  };

  const sizeClass =
    size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${styles[status] || styles.Pending} ${sizeClass}`}
    >
      {icons[status] || icons.Pending}
      {labels[status] || status}
    </span>
  );
}

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  size?: 'sm' | 'md';
}

export function PaymentStatusBadge({
  status,
  size = 'md',
}: PaymentStatusBadgeProps) {
  const styles: Record<PaymentStatus, string> = {
    AwaitingVerification: 'bg-amber-50 text-amber-900 border-amber-300 font-semibold',
    Unpaid: 'bg-stone-100 text-stone-700 border-stone-200',
    Pending: 'bg-amber-50 text-amber-800 border-amber-200',
    'Partially Paid': 'bg-blue-50 text-blue-800 border-blue-200',
    DepositPaid: 'bg-indigo-50 text-indigo-800 border-indigo-200 font-semibold',
    Paid: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    Failed: 'bg-red-50 text-red-800 border-red-200',
    Rejected: 'bg-rose-50 text-rose-800 border-rose-200',
    Refunded: 'bg-purple-50 text-purple-800 border-purple-200',
    'Partially Refunded': 'bg-indigo-50 text-indigo-800 border-indigo-200',
  };

  const icons: Record<PaymentStatus, React.ReactNode> = {
    AwaitingVerification: <Clock className="w-3.5 h-3.5 text-amber-700" />,
    Unpaid: <CreditCard className="w-3.5 h-3.5 text-stone-500" />,
    Pending: <Clock className="w-3.5 h-3.5 text-amber-600" />,
    'Partially Paid': <CreditCard className="w-3.5 h-3.5 text-blue-600" />,
    DepositPaid: <CreditCard className="w-3.5 h-3.5 text-indigo-600" />,
    Paid: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
    Failed: <XCircle className="w-3.5 h-3.5 text-red-600" />,
    Rejected: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
    Refunded: <RotateCcw className="w-3.5 h-3.5 text-purple-600" />,
    'Partially Refunded': <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />,
  };

  const labels: Record<PaymentStatus, string> = {
    AwaitingVerification: 'Awaiting Verification',
    Unpaid: 'Unpaid',
    Pending: 'Pending Payment',
    'Partially Paid': 'Partially Paid',
    DepositPaid: 'Deposit Paid',
    Paid: 'Paid',
    Failed: 'Failed',
    Rejected: 'Rejected',
    Refunded: 'Refunded',
    'Partially Refunded': 'Partially Refunded',
  };

  const sizeClass =
    size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${styles[status] || styles.Unpaid} ${sizeClass}`}
    >
      {icons[status] || icons.Unpaid}
      {labels[status] || status}
    </span>
  );
}

interface ReceiptStatusBadgeProps {
  status: ReceiptVerificationStatus;
  size?: 'sm' | 'md';
}

export function ReceiptStatusBadge({
  status,
  size = 'md',
}: ReceiptStatusBadgeProps) {
  const styles: Record<ReceiptVerificationStatus, string> = {
    NotApplicable: 'bg-stone-50 text-stone-600 border-stone-200',
    PendingReview: 'bg-amber-50 text-amber-900 border-amber-300 font-semibold',
    Verified: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    Rejected: 'bg-red-50 text-red-800 border-red-200',
  };

  const icons: Record<ReceiptVerificationStatus, React.ReactNode> = {
    NotApplicable: null,
    PendingReview: <FileClock className="w-3.5 h-3.5 text-amber-700" />,
    Verified: <FileCheck className="w-3.5 h-3.5 text-emerald-600" />,
    Rejected: <FileX className="w-3.5 h-3.5 text-red-600" />,
  };

  const labels: Record<ReceiptVerificationStatus, string> = {
    NotApplicable: 'No Receipt',
    PendingReview: 'Receipt Pending Review',
    Verified: 'Receipt Verified',
    Rejected: 'Receipt Rejected',
  };

  const sizeClass =
    size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${styles[status] || styles.NotApplicable} ${sizeClass}`}
    >
      {icons[status]}
      {labels[status] || status}
    </span>
  );
}

