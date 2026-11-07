# Phase 9: Step-by-Step Implementation Guide

**Goal:** Replace the simulated payment with a real **Stripe PromptPay** payment in **test mode**, keep the simulated payment as a fallback (`PAYMENT_PROVIDER`), and solve the conflict between the **5-minute seat hold** and the time a customer needs to pay with a banking app.

**Source of truth:** `CiniGo_Phase_Plan.md` → Phase 9 | `CiniGo_Scope.md` Sections 3 (Payments), 4.1 (#4 Checkout), 5 (FR-06, FR-10), 6 (`Payment`)

---

## Overview — What We Build in Phase 9

```
phase/phase9-payments
   └── feature/stripe-promptpay   (stripe SDK, schema + migration, payment-config, payment.service,
                                    payment/webhook API routes, seat lock, PromptPayPanel UI, unit tests, docs)
```

### The problem

Phase 6 holds seats for **5 minutes**. Phase 7 paid instantly (simulated), so 5 minutes was plenty. PromptPay is different: the customer opens a banking app, scans a QR, and confirms. That can take several minutes, and the money arrives at Stripe **outside our app**. Without a design, three things go wrong:

| What can happen | Without a fix |
|---|---|
| Customer is still scanning when the 5-minute hold runs out | Seats are given to someone else while the customer is paying |
| The QR is still valid after the seats were released | Customer pays for seats they no longer have |
| Stripe sends the "paid" webhook late or twice | Booking never confirmed, or two tickets |

### The solution: 3 layers

```
seat selection   ──5 min──▶  click "Pay with PromptPay"
payment window             ├──────── 10 min (QR shown, countdown) ────────┤
seat hold                  ├──────── 10 min ────────┼─ 2 min grace ─┤
                                                    ▲               ▲
                                          we cancel the PI    seats released
```

1. **A separate, longer hold for paying.** Starting the payment extends the hold **once** to 10 min + 2 min grace. Seats are locked while the payment is open. Clicking Pay again reuses the same PaymentIntent (no second extension — otherwise someone could hold seats forever).
2. **The QR stops working when time runs out.** At 10 minutes the server **cancels the PaymentIntent**. Triggers: the customer's countdown, the 3-second status poll, or another customer trying to hold those seats. No cron job (Vercel Hobby crons run at most once a day). If the customer paid at the last second, Stripe refuses the cancel → we settle the payment instead.
3. **The webhook never loses money.** Only Stripe's `payment_intent.succeeded` can mark a booking `PAID`:

| Situation when the payment arrives | Result |
|---|---|
| Booking still owns all its seats (normal case) | `PAID` + ticket |
| Hold expired, but nobody took the seats | Still `PAID` + ticket |
| Some seats now belong to another customer | **Automatic refund**, `Payment.status = REFUNDED` |
| Same event delivered twice | No-op (idempotent settle) |

### Key Deliverables

- **`package.json`** — `stripe` Node SDK.
- **`prisma/schema.prisma`** + migration `20261105090000_stripe_promptpay_payments` — new payment statuses, `PaymentProvider`, payment window columns.
- **`src/lib/payment-config.ts`** — provider switch, 10 + 2 minute window, satang conversion, `decideSettlement()` (pure, unit-tested).
- **`src/lib/stripe.ts`** — lazy Stripe client that refuses live keys.
- **`src/services/payment.service.ts`** — start, settle, close, status sync, webhook handling.
- **API routes** — `POST /api/payments` (provider switch), `GET /api/payments/[id]`, `POST /api/payments/[id]/cancel`, `POST /api/webhooks/stripe`.
- **`src/services/seat.service.ts`** — seats locked while a payment is open.
- **`src/components/checkout/PromptPayPanel.tsx`** — QR, countdown, polling, cancel.
- **`src/tests/unit/payment-config.test.ts`** — unit tests for the rules.

---

## Step 1: Git Branching Setup

```bash
git checkout develop
git pull origin develop

git checkout -b phase/phase9-payments
git checkout -b feature/stripe-promptpay
```

```
main
develop
  └── phase/phase9-payments          <-- Permanent Phase Milestone (NEVER delete)
        └── feature/stripe-promptpay <-- You are HERE
```

---

## Step 2: Stripe Account Setup (Test Mode)

1. Create a Stripe account at <https://dashboard.stripe.com/register>. **The account country must be Thailand** — PromptPay is only offered to Thai Stripe accounts, and the currency is THB.
2. Stay in **Test mode** (toggle at the top of the Dashboard). No business verification is needed for test mode, and no real money moves.
3. **Settings → Payment methods** → enable **PromptPay** (test mode).
4. **Developers → API keys** → copy the **Secret key** (`sk_test_…`).
5. Install the Stripe CLI (<https://docs.stripe.com/stripe-cli>) for local webhooks and run `stripe login`.

Add to `.env` (see `.env.example`):

```bash
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # from `stripe listen` (Step 11)
```

> `src/lib/stripe.ts` refuses any key that does not start with `sk_test_` or `rk_test_`. This project is test mode only.

---

## Step 3: Install the Stripe SDK

```bash
npm install stripe
```

The SDK pins API version `2026-10-28`. In this version the PaymentIntent create parameter is **`allowed_payment_method_types`** (older tutorials use `payment_method_types`, which no longer type-checks).

---

## Step 4: Schema & Migration

`prisma/schema.prisma`:

```prisma
enum PaymentStatus {
  PENDING   // QR shown, waiting for the customer
  SUCCESS
  FAILED
  CANCELLED // window closed or customer cancelled; QR no longer payable
  REFUNDED  // paid after the seats were lost, money returned automatically
}

enum PaymentProvider {
  SIMULATED
  STRIPE
}

model Payment {
  id                   String          @id @default(uuid())
  bookingId            String          @unique
  provider             PaymentProvider @default(SIMULATED)
  status               PaymentStatus
  amount               Decimal
  transactionReference String          @unique // SIM-<uuid> or the Stripe PaymentIntent id (pi_...)
  createdAt            DateTime        @default(now())
  expiresAt            DateTime? // end of the 10-minute payment window (Stripe only)
  paidAt               DateTime? // set only when status becomes SUCCESS
  refundedAt           DateTime?
  booking              Booking         @relation(fields: [bookingId], references: [id])

  @@index([status, expiresAt])
}
```

Why these fields:
- `transactionReference @unique` holds the PaymentIntent id → a duplicate webhook can never create a second payment.
- `expiresAt` is the server-side truth for the 10-minute window (the browser countdown is only a convenience).
- `paidAt` is nullable: a PENDING payment has not been paid.

The migration (`prisma/migrations/20261105090000_stripe_promptpay_payments/migration.sql`) is **additive only** (new enum values, new columns, an index) and backfills `createdAt` from `paidAt` for existing simulated payments.

```bash
npx prisma migrate deploy   # apply (never resets data)
npx prisma generate         # Prisma 7: migrate does not regenerate the client
```

---

## Step 5: Payment Config (`src/lib/payment-config.ts`)

Pure functions — no database, no network — so the rules are easy to unit-test:

| Export | Purpose |
|---|---|
| `PAYMENT_WINDOW_MS` / `PAYMENT_GRACE_MS` | 10 min / 2 min |
| `getPaymentProvider()` | `"stripe"` only when `PAYMENT_PROVIDER=stripe`; otherwise `"simulated"` |
| `getPaymentWindow(now)` | `{ expiresAt: now+10m, holdUntil: now+12m }` |
| `toSatang(baht)` | Stripe uses the smallest unit: ฿280 → `28000` |
| `decideSettlement(...)` | Layer 3: `confirm` or `refund` (with a reason) |

`decideSettlement()` compares the paid amount with **`BookingSeat.priceAtPurchase`** of the seats the booking still holds. Seats are locked during payment, so the only way to lose a seat is another customer holding it after this hold expired — which removes the row from our booking and lowers the sum. Using `priceAtPurchase` (fixed when the payment started) instead of the live `Seat.price` means an admin price change can never trigger a refund.

---

## Step 6: Stripe Client (`src/lib/stripe.ts`)

A lazy singleton: the client is created on first use, so `next build`, CI, and the simulated provider never need a Stripe key. It throws `StripeNotConfiguredError` when the key is missing or not a test key; `POST /api/payments` turns that into a friendly `503`.

---

## Step 7: Payment Service (`src/services/payment.service.ts`)

### `startStripePayment({ userId, showtimeId })` — Layer 1

Three steps, because **network calls must never run inside a database transaction** (a slow Stripe call would hold row locks):

1. **Reserve (DB transaction, RepeatableRead):** check the hold is active and the showtime hasn't started, re-price from `Seat`, set every seat's `heldUntil = now + 12 min` and `priceAtPurchase`, create a `Payment` (`PENDING`, `expiresAt = now + 10 min`, placeholder reference `PENDING-<uuid>`). If the booking already has an open payment → return the same QR (no second extension).
2. **Create the PaymentIntent (Stripe):**

```ts
await getStripe().paymentIntents.create(
  {
    amount: toSatang(amount),
    currency: "thb",
    allowed_payment_method_types: ["promptpay"],
    payment_method_data: { type: "promptpay", billing_details: { email } },
    confirm: true, // returns next_action.promptpay_display_qr_code right away
    metadata: { paymentId, bookingId, userId, showtimeId },
  },
  { idempotencyKey: `cinego-start-${paymentId}` }
);
```

   If Stripe fails, step 1 is undone (payment deleted, original `heldUntil` restored).
3. **Link (compare-and-set):** `updateMany({ where: { id, status: "PENDING" } })` sets `transactionReference = pi_…`. If the payment was closed in the meantime, the new PaymentIntent is cancelled immediately.

The QR comes from `intent.next_action.promptpay_display_qr_code` (`image_url_png`, `hosted_instructions_url`).

### `settleSucceededPayment(paymentId, intent)` — Layer 3

The **only** Stripe path to `PAID`. Called from the webhook, the status poll, and the cancel race. In one RepeatableRead transaction:
- already `SUCCESS` / `REFUNDED` → return the existing result (idempotent);
- `decideSettlement()` says **confirm** → seats `heldUntil = null`, booking `PAID`, payment `SUCCESS` + `paidAt`, ticket created;
- says **refund** → release remaining seats, booking `EXPIRED`; after the transaction call `stripe.refunds.create` (idempotency key `cinego-refund-<paymentId>`) and only then mark `REFUNDED`.

Two settles racing (webhook + poll) → one gets a P2034/P2002 conflict and returns what the winner decided.

### `closePayment(paymentId, reason)` — Layer 2

1. `stripe.paymentIntents.cancel(pi)` so the QR can no longer be paid.
2. If Stripe refuses, retrieve the intent: `succeeded` → settle instead (the customer paid at the last second).
3. Mark the payment `CANCELLED`/`FAILED` (compare-and-set on `PENDING`), delete the booking's seats, set the booking `CANCELLED` (customer) or `EXPIRED` (window/failure).

Because `Payment.bookingId` is unique, a new attempt after closing creates a **new** booking.

### Other exports

| Function | Used by |
|---|---|
| `closeExpiredPaymentsForSeats()` | Hold route: closes expired payments on the requested seats (and the user's own) before holding |
| `getPaymentStatusForUser()` | `GET /api/payments/[id]` — also syncs with Stripe, so the page completes even without webhooks, and closes the payment once `expiresAt` passes |
| `cancelPaymentForUser()` | `POST /api/payments/[id]/cancel` — server decides "customer cancel" vs. "expired" from `expiresAt` |
| `getOpenPromptPayCheckout()` | Checkout page: shows the same QR again after a reload |
| `handleStripeEvent()` | Webhook: `succeeded` → settle, `payment_failed` → close as failed, `canceled` → mark closed |

---

## Step 8: API Routes

| Route | What it does |
|---|---|
| `POST /api/payments` | `PAYMENT_PROVIDER=stripe` → `startStripePayment()` → `{ provider: "stripe", checkout }`; otherwise the Phase 7 simulated payment → `{ provider: "simulated", ticketId }` |
| `GET /api/payments/[id]` | Status for the 3-second poll (owner only) |
| `POST /api/payments/[id]/cancel` | Cancel button / countdown reached zero |
| `POST /api/webhooks/stripe` | Verifies `Stripe-Signature` against the **raw body** (`await request.text()`) with `STRIPE_WEBHOOK_SECRET`; returns 500 on handler errors so Stripe retries |
| `POST /api/showtimes/[id]/seats/hold` | Now calls `closeExpiredPaymentsForSeats()` first |

The webhook route is not under `/admin`, `/profile`, `/tickets`, or `/checkout`, so `proxy.ts` never redirects Stripe to the login page.

---

## Step 9: Lock Seats During Payment (`src/services/seat.service.ts`)

- `holdShowtimeSeats()`: if the user's PENDING booking has a payment → refuse ("Finish or cancel it before changing seats").
- `releaseShowtimeSeats()`: no-op while a payment is open — only `closePayment()` releases those seats.
- `confirmBookingPayment()` (simulated) refuses a booking that already has a payment and now sets `paidAt` explicitly.

---

## Step 10: Checkout UI

- **`SeatHoldTimer`** gets an optional `label` ("Seats held" / "Pay within") so it can count down the payment window too.
- **`PromptPayPanel.tsx`** (new): QR image, amount, 10-minute countdown, "Waiting for payment…", a test-mode link to Stripe's hosted page, and **Cancel payment**. It polls `GET /api/payments/[id]` every 3 s with SWR:
  - `SUCCESS` → `/tickets/[id]?paid=1`
  - `CANCELLED` / `FAILED` / `REFUNDED` → back to the seat map with the message.
- **`SeatSelectionClient.tsx`**: the Pay button reads "Pay ฿X with PromptPay"; while a payment is open the seat map is locked and the panel replaces the booking summary.
- **`page.tsx`**: passes `paymentProvider` and any open checkout, so a reload shows the same QR.

---

## Step 11: Run It Locally

```bash
# Terminal 1 — forward Stripe events to the app; prints the whsec_... secret for .env
stripe listen --forward-to localhost:3000/api/webhooks/stripe \
  --events payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled

# Terminal 2
npm run dev
```

In test mode you don't need a real banking app: click **"Test mode: open Stripe's payment page"** under the QR, then **Authorize** or **Fail** the test payment.

> Even without `stripe listen`, the 3-second status poll asks Stripe directly, so payments still complete — the webhook is what makes it work when the customer closes the tab.

---

## Step 12: Unit Tests

`src/tests/unit/payment-config.test.ts` covers the provider switch, the 10 + 2 minute window, satang conversion, every `decideSettlement()` branch, and the test-key guard.

```bash
npm run lint
npm test
npm run build
```

CI pins `PAYMENT_PROVIDER=simulated`, so the e2e and concurrency tests never call Stripe.

---

## Step 13: Verification Checkpoint

| # | Test | Expected |
|---|---|---|
| 1 | Lock seats → Pay with PromptPay → Authorize on Stripe's test page | Redirect to the ticket within ~3 s |
| 2 | Pay → Fail on Stripe's test page | "Payment failed" message, seats available again |
| 3 | Pay → Cancel payment | Seats released; Stripe Dashboard shows the PaymentIntent as canceled |
| 4 | Pay → reload the page | Same QR and countdown (not extended) |
| 5 | Let the 10-minute countdown run out | PaymentIntent canceled; QR can no longer be paid |
| 6 | `stripe events resend <evt_id>` for a succeeded event | Still exactly one Payment and one Ticket |
| 7 | Late payment after another user took the seats* | `Payment.status = REFUNDED`, refund visible in Stripe |
| 8 | Unset `PAYMENT_PROVIDER` | Simulated payment works as in Phase 7 |

\* To reproduce #7: start a payment, stop `npm run dev` (so nothing cancels it), set the booking's `heldUntil` in the past in Prisma Studio, hold the same seats as another user, then authorize the first payment on Stripe's test page and restart the app with `stripe listen` running.

---

## Step 14: Deploy & Merge

1. Vercel → Project → Settings → Environment Variables: `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
2. Stripe Dashboard → Developers → Webhooks → **Add endpoint** `https://<your-app>.vercel.app/api/webhooks/stripe`, events `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`. Use **its** signing secret in Vercel (it differs from the `stripe listen` one).
3. The migration runs automatically on deploy (`scripts/vercel-build.mjs`).

```bash
git checkout phase/phase9-payments
git merge --ff-only feature/stripe-promptpay
git branch -d feature/stripe-promptpay

git checkout develop
git merge --ff-only phase/phase9-payments
git push origin develop phase/phase9-payments

# Production release
git checkout main
git merge develop
git push origin main
```

---

## Phase 9 Complete — Summary

- Customers pay with a **PromptPay QR** (Stripe test mode); the simulated payment remains as a fallback.
- **Layer 1:** one-time hold extension to a 10-minute window + 2-minute grace, seats locked during payment.
- **Layer 2:** the PaymentIntent is cancelled when the window closes, without a cron job; a last-second payment is settled instead.
- **Layer 3:** only a verified `succeeded` event creates a ticket; lost seats → automatic refund; duplicate events → no-op.
- No Stripe call ever runs inside a database transaction; every state change is a compare-and-set or an idempotent operation.
