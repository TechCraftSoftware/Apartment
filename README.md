# Single-Client Apartment Booking Platform with Paystack Test Mode & Code-Based Booking Access

A full-stack **Single-Client Realtor Apartment Booking Platform** built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and a modular server-side service architecture (`Properties`, `Availability`, `Bookings`, `Customers`, `Payments`, `Notifications`, `Administration`).

Designed and operated for **one realtor client** (`Verdant Stays Lagos`, `clientId: realtor-verdant-stays`), while maintaining clean tenant/client boundaries so future realtor clients and isolated domains can be provisioned without rewriting core booking or availability logic.

---

## 1. Key Capabilities

### A. Public Realtor Website & Guest Privacy Calendar
- **`/`** — Realtor homepage with featured residences, availability search, and direct booking entry points.
- **`/apartments`** — Browse active apartment units with location, guest capacity, and price filters.
- **`/apartments/[id]`** — Detailed unit showcase with amenities, house rules, pricing breakdown, and an interactive availability calendar.
- **`/availability`** — Public-facing availability calendar across all active units.
  - **Strict Guest Privacy**: Public availability endpoints (`/api/public/availability`) and components **never** expose guest names, emails, phone numbers, booking references, payment amounts, special requests, internal IDs, or administrator block reasons. Only neutral `Booked` or `Unavailable` intervals are returned.

### B. Passwordless Customer Creation & Code-Based Booking Access (`/my-booking`)
- **No Customer Login Required**: Customers never create a password or sign in to book an apartment.
- **Automatic Customer Record**: Submitting a booking automatically creates or matches a `CustomerRecord` by normalized email and phone number.
- **Reusable Booking Access Code (emailed)**:
  - When a booking is created (after Paystack payment, bank-transfer submission, or an admin entry), the server generates an 8-character access code such as `K7P4-9QXM` (`crypto.randomInt` over an unambiguous alphabet).
  - **Only the SHA-256 hash (`codeHash`)** is stored in `BookingAccessCredentialRecord`. The code stays valid until 30 days after check-out.
  - The customer receives an email with the code **and** their booking details (apartment, dates, guests, amounts, status). A second email is sent when an admin confirms the booking, including check-in instructions.
  - On **`/my-booking`** the customer enters just the code, as often as they like, to view the booking. They can print it, save it as PDF, or copy the details to share with whoever needs to see them.
  - Lost codes: the customer enters their booking reference plus booking email/phone to get a new code emailed. Issuing a new code disables the old one.
  - Wrong-code attempts are rate limited (5 per 15 minutes per client).
- **Email delivery (SMTP)**: Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` and `EMAIL_FROM` in `.env.local` (see `.env.example`). Emails are sent after the booking is saved, so an SMTP failure never loses a booking; the notification is marked `Failed` and the error is logged.
  - **Development Outbox Preview**: With no `SMTP_HOST`, nothing is emailed and the code is shown in a clearly labelled development preview on `/booking-confirmation/[id]` and `/my-booking` (hidden in production builds).

### C. Paystack Test Mode Payment Flow (`/payment/[bookingId]` & `/payment/callback`)
- **Nigerian Naira (`NGN`) & Kobo Precision**: All Paystack payloads calculate `amountKobo = Math.round(amountNaira * 100)`.
- **Configurable Realtor Payment Policy** (`/admin/settings`):
  - `FullPayment` — Full booking amount collected online; server-side verification automatically confirms the booking.
  - `Deposit` — Configurable deposit percentage (e.g., 50%) collected online; updates payment status to `DepositPaid` and confirms the reservation.
  - `PayAfterApproval` — Realtor Admin reviews and approves the booking request first.
- **Dual Mode Support**:
  - When `PAYSTACK_SECRET_KEY=sk_test_...` is configured in `.env.local`, `/api/payments/initialize` and `/api/payments/verify` call the live Paystack Test API (`https://api.paystack.co/transaction/initialize` and `https://api.paystack.co/transaction/verify/:reference`).
  - When no external key is present, the service runs in a clearly labelled **`SIMULATED_TEST_MODE`** interactive checkout on `/payment/[bookingId]` with one-click *Simulate Paystack Test Success* and *Simulate Declined / Failed Payment* actions that redirect through `/payment/callback` for server-side idempotent verification.
- **Idempotent Server Verification**: Re-verifying the same Paystack reference never duplicates payment records or double-counts `amountPaid`.

### D. Protected Realtor Administration Dashboard (`/admin/*`)
- **`/admin/login`** — Administrator authentication (`admin@staydemo.com` / `Admin123!`).
- **`/admin`** — Real-time occupancy inspector, pending booking requests, upcoming check-ins/check-outs, and verified Paystack revenue summary.
- **`/admin/apartments`**, **`/admin/apartments/new`**, **`/admin/apartments/[id]/edit`** — Manage parent properties and rentable apartment units.
- **`/admin/calendar`** — Full administrator availability calendar (shows guest names, booking references, and internal maintenance block reasons).
- **`/admin/bookings`** & **`/admin/bookings/[id]`** — Filter by Booking Status (`Pending`, `Confirmed`, `Cancelled`, `Rejected`, `Completed`, `Expired`) and Payment Status (`Unpaid`, `DepositPaid`, `Paid`, `Failed`, `Refunded`), record **External Bookings** (`WHATSAPP`, `INSTAGRAM`, `PHONE`, `WALK_IN`) that immediately block public calendar dates, and re-issue customer verification codes.
- **`/admin/payments`** — Paystack Test Mode transaction ledger and revenue KPIs.
- **`/admin/settings`** — Configure Realtor business identity, dedicated domain, payment policy, deposit percentage, and verification code expiry window.

---

## 2. Quick Start & Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run end-to-end automated verification suite (all 6 mandatory scenarios)
npm test

# Type-check & lint
npm run typecheck
npm run lint

# Production build
npm run build
```

---

## 3. Demo Credentials & Seeded Test Data

- **Realtor Admin Login (`/admin/login`)**:
  - Email: `admin@staydemo.com`
  - Password: `Admin123!`
- **Sample Seeded Bookings for `/my-booking` Verification**:
  - **Booking Reference**: `BK-2026-8421`
    - Email: `adaeze.nwosu@lagosmail.ng` | Phone: `+234 803 412 8890`
    - Demo Access Code: `842101`
  - **Booking Reference**: `BK-2026-9104` (Pending & Unpaid — great for testing Paystack Test Mode checkout!)
    - Email: `tunde.bakare@victoriafinance.com` | Phone: `+234 809 221 6743`
    - Demo Access Code: `910402`
