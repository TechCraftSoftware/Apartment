/**
 * Part-payment rules shared by the checkout UI and the payment services.
 *
 * - First payment on a booking: at least `depositPercentage`% of the total
 *   (set in Realtor settings), up to the full amount.
 * - Later payments: any amount from ₦1,000 (or the remaining balance if it is
 *   smaller) up to the remaining balance.
 */
export const MIN_FOLLOW_UP_PAYMENT_NGN = 1000;

export function getPaymentLimits(params: {
  totalPrice: number;
  amountAlreadyPaid: number;
  depositPercentage: number;
}): { minAmount: number; maxAmount: number } {
  const total = Math.max(0, Math.round(params.totalPrice));
  const paid = Math.max(0, Math.round(params.amountAlreadyPaid));
  const balance = Math.max(0, total - paid);
  const pct = Math.min(100, Math.max(1, params.depositPercentage || 50));
  const firstPaymentMin = Math.ceil((total * pct) / 100);
  const minAmount =
    paid > 0
      ? Math.min(balance, MIN_FOLLOW_UP_PAYMENT_NGN)
      : Math.min(balance, firstPaymentMin);
  return { minAmount, maxAmount: balance };
}

export function resolvePaymentAmount(params: {
  totalPrice: number;
  amountAlreadyPaid: number;
  depositPercentage: number;
  requestedAmount?: number | null;
}):
  | { ok: true; amount: number; isPartPayment: boolean }
  | { ok: false; error: string } {
  const { minAmount, maxAmount } = getPaymentLimits(params);
  if (maxAmount <= 0) {
    return { ok: false, error: 'This booking has already been paid in full.' };
  }

  const requested = params.requestedAmount;
  if (requested === undefined || requested === null) {
    return { ok: true, amount: maxAmount, isPartPayment: false };
  }

  const amount = Math.round(Number(requested));
  if (!Number.isFinite(amount) || amount < minAmount || amount > maxAmount) {
    return {
      ok: false,
      error: `Enter an amount between ₦${minAmount.toLocaleString()} and ₦${maxAmount.toLocaleString()}.`,
    };
  }

  return { ok: true, amount, isPartPayment: amount < maxAmount };
}
