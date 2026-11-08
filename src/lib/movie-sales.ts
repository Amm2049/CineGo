// src/lib/movie-sales.ts
// A hidden (inactive) movie is off sale: no new seat holds and no new payments (Phase 10).
// Tickets already bought stay valid, and a PromptPay payment that was already open may still
// finish (the customer may have scanned the QR already; blocking it would only cause a refund).

export const MOVIE_NOT_ON_SALE = "This movie is no longer on sale.";
