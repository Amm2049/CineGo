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
- `confirmBookingPayment()` in `src/services/booking.service.ts` is the only path to `PAID`: it requires an active hold, re-prices from `Seat`, and writes Booking/Payment/Ticket in one `RepeatableRead` transaction.
- Ticket QR payload is `CINEGO:<ticketCode>` (UUID). Use `parseQrPayload()` from `ticket.service.ts` in the Phase 8 scanner — it also accepts a bare code typed manually.
- `npm run test:concurrency` races holds/payments against the real DB (needs a future showtime; cleans up its own test users).
- Seed creates `admin@cinego.com` / `admin123`. Re-running the seed wipes ALL data, including users.

## Screens / theatres
- `Screen.name` is the theatre ("Theatre 1"), `Screen.number` its number (unique per cinema), `Screen.format` the projection format ("IMAX Laser"). Format badges on movie cards read `screen.format`, never `screen.name`.

## Admin & deployment (Phase 8)
- Every `/api/admin/*` route must call `requireAdmin()` or `requireStaff()` (`src/lib/admin-guard.ts`); `proxy.ts` does not cover APIs.
- Roles: CUSTOMER, STAFF (scanner + verify-ticket only), ADMIN. Admin-only pages call `requireAdminPage()`. Seed creates `staff@cinego.com` / `staff123`.
- `/api/cron/sync-movies` is protected by `Bearer CRON_SECRET` (fails closed if unset). Schedule in `vercel.json`.
- TMDB lists use `region=TH`; `Movie.releaseDate` is the Thai theatrical date from `release_dates`. Never fake dates.
- Sync never overwrites `Movie.title/description/isActive` (admin-owned). Inactive movies are hidden, not deleted.
- Showtime creation runs at Serializable (overlap = write skew), retried up to 3x on P2034, backed by `@@index([screenId, startsAt])`. 25-min cleaning buffer lives in `src/lib/schedule.ts`.
- Ticket scan uses `updateMany WHERE status=ACTIVE` (compare-and-set); never read-then-update. It records `usedAt` and `scannedById` (from the session, never the body).
- Server components must format times with `timeZone: Asia/Bangkok` (Vercel runs in UTC). Use helpers in `src/lib/schedule.ts`.
- Prisma 7: `migrate dev` does not regenerate the client — run `npx prisma generate` after schema changes.
- Production deploys run `prisma migrate deploy` automatically (`scripts/vercel-build.mjs`, `DIRECT_URL`). Never run the seed against production.
