'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, QrCode } from 'lucide-react';
import { formatDisplayDate, formatNaira } from '@/lib/utils';

export interface BookingPassDetails {
  businessName: string;
  bookingReference: string;
  guestName: string;
  apartmentName: string;
  apartmentLocation?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  bookingStatus: string;
  paymentStatus: string;
  amountPaid: number;
  balanceAmount: number;
}

const STATUS_LABELS: Record<string, string> = {
  PendingApproval: 'Pending approval',
  Pending: 'Pending approval',
  Confirmed: 'Confirmed',
  Rejected: 'Rejected',
  Cancelled: 'Cancelled',
  Completed: 'Completed',
  Expired: 'Expired',
};

/**
 * The QR opens the booking in the admin dashboard, so staff can scan it at
 * check-in (they must be signed in; anyone else just gets the login page).
 */
function bookingPassQrValue(reference: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/admin/bookings/${encodeURIComponent(reference)}`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws the pass as a portrait PNG (phone-screen friendly) and downloads it. */
async function downloadPassImage(pass: BookingPassDetails, qrDataUrl: string) {
  const W = 720;
  const H = 1180;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#f5f2ec';
  ctx.fillRect(0, 0, W, H);
  drawRoundedRect(ctx, 30, 30, W - 60, H - 60, 36);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Header band
  ctx.save();
  drawRoundedRect(ctx, 30, 30, W - 60, 190, 36);
  ctx.clip();
  ctx.fillStyle = '#14352b';
  ctx.fillRect(30, 30, W - 60, 190);
  ctx.restore();

  ctx.fillStyle = '#a7d7c5';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillText('BOOKING PASS', 70, 90);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText(pass.businessName, 70, 145);
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillStyle = '#d6e4de';
  ctx.fillText('Show this at check-in', 70, 190);

  // QR code
  const qrImg = new Image();
  qrImg.src = qrDataUrl;
  await new Promise<void>((resolve) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = () => resolve();
  });
  const qrSize = 340;
  ctx.drawImage(qrImg, (W - qrSize) / 2, 255, qrSize, qrSize);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#78716c';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText('BOOKING CODE', W / 2, 640);
  ctx.fillStyle = '#1c1917';
  ctx.font = 'bold 46px ui-monospace, Menlo, monospace';
  ctx.fillText(pass.bookingReference, W / 2, 695);
  ctx.textAlign = 'left';

  // Details
  const rows: Array<[string, string]> = [
    ['Guest', pass.guestName],
    ['Apartment', pass.apartmentName],
    ['Check-in', formatDisplayDate(pass.checkIn)],
    ['Check-out', formatDisplayDate(pass.checkOut)],
    ['Stay', `${pass.nights} night${pass.nights === 1 ? '' : 's'} • ${pass.guests} guest${pass.guests === 1 ? '' : 's'}`],
    ['Status', STATUS_LABELS[pass.bookingStatus] || pass.bookingStatus],
    ['Payment', `${formatNaira(pass.amountPaid)} paid • ${formatNaira(pass.balanceAmount)} due`],
  ];
  let y = 760;
  ctx.strokeStyle = '#e7e5e4';
  ctx.beginPath();
  ctx.moveTo(70, y - 30);
  ctx.lineTo(W - 70, y - 30);
  ctx.stroke();
  for (const [label, value] of rows) {
    ctx.fillStyle = '#78716c';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText(label, 70, y);
    ctx.fillStyle = '#1c1917';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.textAlign = 'right';
    let text = value;
    while (ctx.measureText(text).width > W - 300 && text.length > 4) {
      text = `${text.slice(0, -4)}…`;
    }
    ctx.fillText(text, W - 70, y);
    ctx.textAlign = 'left';
    y += 50;
  }

  const link = document.createElement('a');
  link.download = `booking-pass-${pass.bookingReference}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function BookingPassCard({ pass }: { pass: BookingPassDetails }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(bookingPassQrValue(pass.bookingReference), {
      width: 480,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#14352b', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pass.bookingReference]);

  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-3xl border border-stone-200/90 shadow-md overflow-hidden">
      <div className="bg-brand-900 text-white px-5 py-4">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-brand-300 flex items-center gap-1.5">
          <QrCode className="w-3.5 h-3.5" />
          Booking Pass
        </span>
        <p className="font-serif text-xl font-bold mt-0.5 break-words">{pass.businessName}</p>
        <p className="text-xs text-stone-300">Show this at check-in</p>
      </div>

      <div className="px-5 pt-5 pb-4 flex flex-col items-center text-center">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt={`QR code for booking ${pass.bookingReference}`}
            className="w-48 h-48 sm:w-52 sm:h-52"
          />
        ) : (
          <div className="w-48 h-48 rounded-2xl bg-stone-100 animate-pulse" />
        )}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mt-3">
          Booking Code
        </span>
        <span className="font-mono text-2xl font-bold text-stone-900 tracking-wide break-all">
          {pass.bookingReference}
        </span>
      </div>

      <dl className="px-5 pb-4 text-sm divide-y divide-stone-100 border-t border-stone-100">
        {[
          ['Guest', pass.guestName],
          ['Apartment', pass.apartmentName],
          ['Check-in', formatDisplayDate(pass.checkIn)],
          ['Check-out', formatDisplayDate(pass.checkOut)],
          [
            'Stay',
            `${pass.nights} night${pass.nights === 1 ? '' : 's'} • ${pass.guests} guest${pass.guests === 1 ? '' : 's'}`,
          ],
          ['Status', STATUS_LABELS[pass.bookingStatus] || pass.bookingStatus],
          [
            'Payment',
            `${formatNaira(pass.amountPaid)} paid • ${formatNaira(pass.balanceAmount)} due`,
          ],
        ].map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-3 py-2">
            <dt className="text-stone-500 shrink-0">{label}</dt>
            <dd className="font-semibold text-stone-900 text-right break-words min-w-0">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="px-5 pb-5 print:hidden">
        <button
          type="button"
          disabled={!qrDataUrl}
          onClick={() => qrDataUrl && downloadPassImage(pass, qrDataUrl)}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Download Pass (PNG)</span>
        </button>
        <p className="text-[11px] text-stone-500 text-center mt-2">
          Or take a screenshot. Staff scan the QR code to open your booking.
        </p>
      </div>
    </div>
  );
}
