@AGENTS.md

# CineGo project notes

Specs live in `CiniGo_Scope.md` (requirements, FR-xx), `CiniGo_Phase_Plan.md` (phase checklist), and `Phase*_Guide.md` (step-by-step guides). Check them before deciding whether behavior is intended.

## Git workflow
- `feature/*` → `phase/phaseN-*` → `develop`. Phase branches are kept on GitHub after merging.
- Merges into `develop` have been fast-forwards (no merge commits).
- `main` has not received any phase work yet — diff against `develop` or the previous phase, not `main`, when reviewing a phase.

## Seat holds (Phase 6) — invariants to keep
- `holdShowtimeSeats()` in `src/services/seat.service.ts` runs at `RepeatableRead` isolation so concurrent holds on the same seat fail instead of overwriting another customer's hold (FR-06). `@@unique([showtimeId, seatId])` covers concurrent inserts.
- Held seats must belong to the showtime's screen (`seat.screenId === showtime.screenId`); prices come from the DB, never the client.
- Deselecting a held seat releases it on the server; newly added seats must be re-locked before "Proceed to Payment". Expiry releases all of the user's held seats.
- `SeatHoldTimer` keeps `onExpire` in a ref — don't put callbacks in its effect deps.
- The legacy `holdSeat()` helper upserts without any conflict check and is unused. In Phase 7, use `holdShowtimeSeats()` (or add a conflict check) rather than `holdSeat()`.

## Checkout & tickets (Phase 7)
- Simulated payment: `confirmBookingPayment()` in `src/services/booking.service.ts` requires an active hold, re-prices from `Seat`, and writes Booking/Payment/Ticket in one `RepeatableRead` transaction. With Stripe, the only path to `PAID` is `settleSucceededPayment()` (Phase 9).
- Ticket QR payload is `CINEGO:<ticketCode>` (UUID). Use `parseQrPayload()` from `ticket.service.ts` in the Phase 8 scanner — it also accepts a bare code typed manually.
- `npm run test:concurrency` races holds/payments against the real DB (needs a future showtime; cleans up its own test users).
- `npm run dev:ticket -- <customer email> [--seats N] [--within MIN]` (DEV ONLY, refuses in production): books a paid ticket for the next show starting within 60 min via the real hold → simulated-payment flow, and prints the ticket URL and code for scanner testing.
- Seed creates `admin@cinego.com` / `admin123`. Re-running the seed wipes ALL data, including users.

## Browsing → booking (Phase 10)
- Movie cards and the hero open `/movies/[id]` (showtime picker: `getMovieWithShowtimes()`), never a checkout directly. Group showtimes by Bangkok day with `cinemaDayOf()`; always `orderBy: { startsAt: "asc" }` when picking a "next" showtime.
- The seat map's "Change showtime" link is hidden while a PromptPay payment is open and releases held seats on click.
- Hidden (inactive) movies are off sale: `holdShowtimeSeats()`, `confirmBookingPayment()` and a NEW `startStripePayment()` refuse with `MOVIE_NOT_ON_SALE` (`src/lib/movie-sales.ts`); a PromptPay payment already open may still finish; sold tickets stay valid and scannable. The admin table shows tickets sold for upcoming shows and asks before deactivating a movie that has any.
- AI match badges need a taste signal: `getMovieRecommendationsMap()` returns `{}` (no badges, no Gemini call) for a customer with no favourite genres and no PAID booking. Saving genres or paying clears the cached scores, so badges appear on the next visit.
- `(customer)/loading.tsx` streams pages, so `notFound()` there renders the 404 page with HTTP 200; test the visible content, not the status.

## Screens / theatres
- `Screen.name` is the theatre ("Theatre 1"), `Screen.number` its number (unique per cinema), `Screen.format` the projection format ("IMAX Laser"). Format badges on movie cards read `screen.format`, never `screen.name`.

## Admin & deployment (Phase 8)
- Every `/api/admin/*` route must call `requireAdmin()` or `requireStaff()` (`src/lib/admin-guard.ts`); `proxy.ts` does not cover APIs.
- Roles: CUSTOMER, STAFF (scanner + verify-ticket only), ADMIN. Admin-only pages call `requireAdminPage()`. Seed creates `staff@cinego.com` / `staff123`.
- Only CUSTOMER accounts book (Phase 10): booking/payment/interests APIs call `requireCustomer()` (`admin-guard.ts`); `/tickets` and `/profile` send ADMIN/STAFF to `homePathForRole()`; `/checkout` shows a "customer accounts only" message. Role rules and post-login redirects live in `src/lib/roles.ts` (`postLoginPath()` follows `callbackUrl` only for local paths the role may use). Admin lands on `/admin`, staff on `/admin/scanner`.
- `/api/cron/sync-movies` is protected by `Bearer CRON_SECRET` (fails closed if unset). Schedule in `vercel.json`.
- TMDB lists use `region=TH`; `Movie.releaseDate` is the Thai theatrical date from `release_dates`. Never fake dates.
- Sync never overwrites `Movie.title/description/isActive` (admin-owned). Inactive movies are hidden, not deleted.
- Admin Showtimes form (Phase 10): the form date IS the schedule date (`?date=`); times are hour/minute selects (24 h, Bangkok); the default start comes from `nextFreeStart()` in `schedule.ts`; a clash, a past time or a past day disables Create (red error, "Use next free time"). The client pre-check only sees that day's shows; the server transaction stays the rule.
- Showtime creation runs at Serializable (overlap = write skew), retried up to 3x on P2034, backed by `@@index([screenId, startsAt])`. 25-min cleaning buffer lives in `src/lib/schedule.ts`.
- Scanner UI (Phase 10): the result covers the paused camera; labels and next steps per outcome live in `OUTCOMES` in `ScannerClient.tsx`. `QrScanner` restarts the camera on "Try again" by bumping an `attempt` key (fresh element + effect). Headless Chrome can't flip a denied camera to allowed; to test the retry, make the first `getUserMedia` call reject via an init script.
- Ticket scan uses `updateMany WHERE status=ACTIVE` (compare-and-set); never read-then-update. It records `usedAt` and `scannedById` (from the session, never the body).
- Server components must format times with `timeZone: Asia/Bangkok` (Vercel runs in UTC). Use helpers in `src/lib/schedule.ts`.
- Known warning, not ours: pg 8.23 prints "Calling client.query() when the client is already executing a query" during transactions. Prisma 7.10's query interpreter runs a nested `include`'s child queries with `Promise.all` on the transaction's single connection; pg 8 queues them, so results are correct. Keep `pg` on `^8` until Prisma fixes this (pg 9 will make it an error). Don't hide the warning.
- Images (Next 16): `priority` is deprecated; mark the LCP image with `loading="eager"` + `fetchPriority="high"` (MovieCard `priority` prop does this). Fixed-size thumbnails in flex rows need both dimensions in CSS plus `shrink-0`. `<html>` has `data-scroll-behavior="smooth"` because globals.css sets smooth scrolling.
- Prisma 7: `migrate dev` does not regenerate the client — run `npx prisma generate` after schema changes.
- Production deploys run `prisma migrate deploy` automatically (`scripts/vercel-build.mjs`, `DIRECT_URL`). Never run the seed against production.

## Payments: Stripe PromptPay (Phase 9)
- `PAYMENT_PROVIDER=stripe` switches `/api/payments` to Stripe PromptPay; unset/anything else = simulated (CI sets `simulated`). `src/lib/stripe.ts` refuses non-test keys.
- Stripe API 2026-10 uses `allowed_payment_method_types` (not `payment_method_types`) on PaymentIntent create.
- Starting a payment extends the hold ONCE: `expiresAt` = now + 10 min (shown to the customer), `heldUntil` = expiresAt + 2 min grace (`src/lib/payment-config.ts`). A second "Pay" reuses the open PaymentIntent and never extends again.
- While a Payment is PENDING, the booking's seats are locked: `holdShowtimeSeats()` refuses changes and `releaseShowtimeSeats()` is a no-op. Only `closePayment()` releases them.
- Only a `succeeded` PaymentIntent can create a ticket, via `settleSucceededPayment()` in `src/services/payment.service.ts` (webhook, 3-s status poll, and the cancel race all call it; idempotent). It confirms if `sum(BookingSeat.priceAtPurchase) == Payment.amount`, otherwise refunds (`decideSettlement()`); never compare against live `Seat.price`.
- `closePayment()` cancels the PaymentIntent first; if Stripe refuses because it already succeeded, it settles instead. Closing deletes the BookingSeats and sets the booking EXPIRED/CANCELLED (Payment.bookingId is unique, so a new attempt needs a new booking).
- No cron for expiry (Vercel Hobby crons are daily): the customer's countdown, the status poll, and `closeExpiredPaymentsForSeats()` in the hold route close expired payments.
- Stripe calls never run inside a Prisma transaction: reserve in the DB, call Stripe, then link `transactionReference` (`PENDING-…` → `pi_…`) with a compare-and-set.
- Webhook: `/api/webhooks/stripe`, signature checked against the raw body with `STRIPE_WEBHOOK_SECRET`; handler errors return 500 so Stripe retries.
- `npm run test:integration` (`vitest.integration.config.ts`, `src/tests/integration/`) runs the payment services against the real DB with an in-memory fake Stripe; time passing = moving `expiresAt`/`heldUntil` into the past. Excluded from `npm test`; CI runs it after the seed.
