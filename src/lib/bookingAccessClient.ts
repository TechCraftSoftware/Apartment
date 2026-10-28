'use client';

import { useEffect, useState } from 'react';
import type { Booking } from '@/types';

/**
 * Short-lived booking-access session token (30 min), issued by /my-booking code
 * verification, a verified Paystack callback, or a bank-transfer submission.
 * It unlocks exactly one booking, so pages never need the full bookings list.
 */
export const BOOKING_ACCESS_TOKEN_STORAGE_KEY = 'verdant_booking_access_session_token_v1';

export function getStoredBookingAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(BOOKING_ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeBookingAccessToken(token: string | null | undefined): void {
  if (typeof window === 'undefined' || !token) return;
  try {
    sessionStorage.setItem(BOOKING_ACCESS_TOKEN_STORAGE_KEY, token);
  } catch {}
}

export function clearBookingAccessToken(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(BOOKING_ACCESS_TOKEN_STORAGE_KEY);
  } catch {}
}

/**
 * Loads the guest's own booking through their access session. Resolves to
 * null when there is no session or the session belongs to another booking.
 */
export function useGuestBooking(bookingIdOrReference: string) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const token = getStoredBookingAccessToken();
    if (!token || !bookingIdOrReference) {
      setBooking(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetch('/api/my-booking/session', {
      cache: 'no-store',
      headers: { 'x-booking-access-token': token },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const gb: Booking | undefined = data?.guestBooking;
        const key = bookingIdOrReference.toUpperCase();
        const matches =
          gb &&
          (gb.id === bookingIdOrReference ||
            gb.reference?.toUpperCase() === key ||
            gb.bookingReference?.toUpperCase() === key);
        setBooking(matches ? gb : null);
      })
      .catch(() => {
        if (!cancelled) setBooking(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bookingIdOrReference, reloadKey]);

  return { booking, isLoading, reload: () => setReloadKey((k) => k + 1) };
}
