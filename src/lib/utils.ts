/**
 * Formats a number as Nigerian Naira (₦)
 */
export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}

/**
 * Returns today's date as YYYY-MM-DD in local time
 */
export function getTodayStr(): string {
  const now = new Date();
  return formatDateYMD(now);
}

/**
 * Formats a Date object as YYYY-MM-DD using local calendar components
 */
export function formatDateYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string into a local Date object at midnight
 */
export function parseDateYMD(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Adds `days` to a YYYY-MM-DD date string and returns a new YYYY-MM-DD string
 */
export function addDays(dateStr: string, days: number): string {
  const d = parseDateYMD(dateStr);
  d.setDate(d.getDate() + days);
  return formatDateYMD(d);
}

/**
 * Calculates the number of nights between checkIn (inclusive) and checkOut (exclusive).
 * Returns 0 if invalid or checkOut <= checkIn.
 */
export function calculateNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const start = parseDateYMD(checkIn);
  const end = parseDateYMD(checkOut);
  const diffMs = end.getTime() - start.getTime();
  const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return nights > 0 ? nights : 0;
}

/**
 * Formats a YYYY-MM-DD string into a human-friendly date (e.g., "Oct 18, 2026")
 */
export function formatDisplayDate(dateStr: string, includeWeekday = false): string {
  if (!dateStr) return '—';
  const d = parseDateYMD(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: includeWeekday ? 'short' : undefined,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats a YYYY-MM-DD string into short month & day (e.g., "Oct 18")
 */
export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = parseDateYMD(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Generates all YYYY-MM-DD dates in [startDate, endDate) (startDate inclusive, endDate exclusive)
 */
export function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const nights = calculateNights(startDate, endDate);
  for (let i = 0; i < nights; i++) {
    dates.push(addDays(startDate, i));
  }
  return dates;
}

/**
 * Generates a unique booking reference (e.g. "VRD-2026-8492")
 */
export function generateBookingReference(): string {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `VRD-${year}-${suffix}`;
}
