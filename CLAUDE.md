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
