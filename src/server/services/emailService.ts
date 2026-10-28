import nodemailer from 'nodemailer';
import { withDatabaseTransaction } from '@/server/db/database';
import type { CustomerBookingVerifiedView } from '@/types';

/**
 * Outbound customer email delivery (SMTP via nodemailer).
 *
 * Services queue emails while inside a synchronous database transaction, and
 * API routes call `deliverQueuedBookingEmails()` after the transaction has been
 * written, so an SMTP failure never rolls back a booking or payment.
 *
 * Required env: SMTP_HOST, SMTP_USER, SMTP_PASS. Optional: SMTP_PORT (587),
 * SMTP_SECURE ("true" for port 465), EMAIL_FROM. Without SMTP_HOST, emails are
 * not sent and the development outbox preview is used instead.
 */

export type BookingEmailKind = 'ACCESS_CODE' | 'BOOKING_CONFIRMED';

export interface QueuedBookingEmail {
  kind: BookingEmailKind;
  notificationId: string;
  recipientEmail: string;
  subject: string;
  accessCode: string | null;
  booking: CustomerBookingVerifiedView;
}

const outbox: QueuedBookingEmail[] = [];

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim());
}

export function queueBookingEmail(email: QueuedBookingEmail): void {
  if (!isEmailDeliveryConfigured()) return;
  outbox.push(email);
}

let cachedTransport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter {
  if (!cachedTransport) {
    const port = Number(process.env.SMTP_PORT) || 587;
    cachedTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return cachedTransport;
}

export async function deliverQueuedBookingEmails(): Promise<void> {
  const pending = outbox.splice(0, outbox.length);
  if (pending.length === 0) return;

  const results: { notificationId: string; sent: boolean }[] = [];
  for (const email of pending) {
    try {
      const { html, text } = renderBookingEmail(email);
      await getTransport().sendMail({
        from:
          process.env.EMAIL_FROM ||
          `"${email.booking.realtorBusinessName}" <${process.env.SMTP_USER}>`,
        to: email.recipientEmail,
        replyTo: email.booking.realtorContactEmail,
        subject: email.subject,
        text,
        html,
      });
      results.push({ notificationId: email.notificationId, sent: true });
    } catch (err) {
      console.error(
        `[email] Failed to send ${email.kind} for ${email.booking.bookingReference}:`,
        err instanceof Error ? err.message : err
      );
      results.push({ notificationId: email.notificationId, sent: false });
    }
  }

  withDatabaseTransaction((db) => {
    for (const r of results) {
      const notification = db.notifications.find((n) => n.id === r.notificationId);
      if (notification) {
        notification.deliveryStatus = r.sent ? 'Sent' : 'Failed';
      }
    }
  });
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatNgn(amount: number): string {
  return `NGN ${Math.round(amount).toLocaleString('en-NG')}`;
}

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function renderBookingEmail(email: QueuedBookingEmail): { html: string; text: string } {
  const b = email.booking;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const myBookingUrl = `${appUrl}/my-booking`;

  const intro =
    email.kind === 'BOOKING_CONFIRMED'
      ? `Great news — your booking ${b.bookingReference} has been confirmed.`
      : `Thank you for booking with ${b.realtorBusinessName}. Here are your booking details and your personal access code.`;

  const rows: [string, string][] = [
    ['Booking reference', b.bookingReference],
    ['Apartment', `${b.apartmentName} (${b.unitType})`],
    ['Location', b.apartmentAddress],
    ['Check-in', `${formatDate(b.checkIn)} from ${b.checkInTime}`],
    ['Check-out', `${formatDate(b.checkOut)} by ${b.checkOutTime}`],
    ['Stay', `${b.nights} night${b.nights === 1 ? '' : 's'} • ${b.guests} guest${b.guests === 1 ? '' : 's'}`],
    ['Total', formatNgn(b.totalPrice)],
    ['Amount paid', formatNgn(b.amountPaid)],
    ['Balance due', formatNgn(b.balanceAmount)],
    ['Booking status', b.status === 'PendingApproval' ? 'Awaiting confirmation' : b.status],
  ];

  const codeBlockHtml = email.accessCode
    ? `<div style="margin:24px 0;padding:20px;border-radius:12px;background:#ecfdf5;border:1px solid #a7f3d0;text-align:center">
        <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#065f46">Your booking access code</div>
        <div style="font-family:Consolas,Menlo,monospace;font-size:30px;font-weight:700;letter-spacing:4px;color:#064e3b;margin-top:6px">${escapeHtml(email.accessCode)}</div>
        <div style="font-size:13px;color:#065f46;margin-top:8px">Enter this code at <a href="${myBookingUrl}" style="color:#047857">${escapeHtml(myBookingUrl)}</a> to view your booking any time.</div>
      </div>`
    : '';

  const instructionsHtml =
    b.status === 'Confirmed'
      ? `<h3 style="font-size:15px;margin:24px 0 6px">Check-in instructions</h3>
         <p style="margin:0;color:#44403c;line-height:1.5">${escapeHtml(b.checkInInstructions || '')}</p>`
      : `<p style="margin:20px 0 0;color:#44403c;line-height:1.5">${escapeHtml(b.nextStepsSummary || '')}</p>`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f5f5f4;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1c1917">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="background:#ffffff;border-radius:16px;border:1px solid #e7e5e4;padding:28px">
      <div style="font-size:13px;font-weight:600;color:#047857">${escapeHtml(b.realtorBusinessName)}</div>
      <h1 style="font-size:22px;margin:6px 0 4px">Hello ${escapeHtml(b.customerFullName)},</h1>
      <p style="margin:0;color:#44403c;line-height:1.5">${escapeHtml(intro)}</p>
      ${codeBlockHtml}
      <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td style="padding:8px 0;border-bottom:1px solid #f5f5f4;color:#78716c">${escapeHtml(label)}</td><td style="padding:8px 0;border-bottom:1px solid #f5f5f4;text-align:right;font-weight:600">${escapeHtml(value)}</td></tr>`
          )
          .join('')}
      </table>
      ${instructionsHtml}
      <p style="margin:24px 0 0;font-size:13px;color:#78716c;line-height:1.5">
        Questions? Call ${escapeHtml(b.realtorContactPhone)} or reply to this email.
        Keep your access code private — anyone with it can view this booking.
      </p>
    </div>
  </div>
</body></html>`;

  const text = [
    `Hello ${b.customerFullName},`,
    '',
    intro,
    '',
    ...(email.accessCode
      ? [`Your booking access code: ${email.accessCode}`, `View your booking: ${myBookingUrl}`, '']
      : []),
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    b.status === 'Confirmed' ? `Check-in instructions: ${b.checkInInstructions}` : b.nextStepsSummary,
    '',
    `Questions? Call ${b.realtorContactPhone}.`,
    `— ${b.realtorBusinessName}`,
  ].join('\n');

  return { html, text };
}
