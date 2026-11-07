// src/lib/payment-config.ts
// CineGo — Payment provider selection, the PromptPay payment window, and the pure
// "confirm or refund?" rule used when Stripe reports a successful payment (Phase 9).

import type { PaymentProviderName } from "@/types";

/** How long the customer has to scan and pay the PromptPay QR. */
export const PAYMENT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/** Extra seat-hold time after the window closes, so a late webhook still finds the seats. */
export const PAYMENT_GRACE_MS = 2 * 60 * 1000; // 2 minutes

/**
 * PAYMENT_PROVIDER=stripe enables Stripe PromptPay. Anything else (including unset) keeps the
 * simulated payment, which CI, the concurrency test, and offline demos rely on.
 */
export function getPaymentProvider(
  value: string | undefined = process.env.PAYMENT_PROVIDER,
): PaymentProviderName {
  return value?.trim().toLowerCase() === "stripe" ? "stripe" : "simulated";
}

/**
 * Starting a PromptPay payment extends the seat hold once:
 * the customer sees `expiresAt` (now + 10 min); the seats stay held until `holdUntil` (+2 min grace).
 */
export function getPaymentWindow(now: Date): {
  expiresAt: Date;
  holdUntil: Date;
} {
  const expiresAt = new Date(now.getTime() + PAYMENT_WINDOW_MS);
  const holdUntil = new Date(expiresAt.getTime() + PAYMENT_GRACE_MS);
  return { expiresAt, holdUntil };
}

/** Stripe amounts are in the smallest currency unit: 1 THB = 100 satang. */
export function toSatang(amountBaht: number): number {
  return Math.round(amountBaht * 100);
}

export type SettlementDecision =
  { action: "confirm" } | { action: "refund"; reason: string };

/**
 * Stripe says the customer paid. Do they still own every seat they paid for?
 *
 * Seats are locked while a payment is open, so the only way a booking loses seats is another
 * customer holding them after this hold (window + grace) expired. Comparing the paid amount with
 * the prices of the seats the booking still holds therefore detects any lost seat.
 * `heldPrices` must be BookingSeat.priceAtPurchase (fixed when the payment started), so an admin
 * price change in between can never trigger a refund.
 */
export function decideSettlement(input: {
  bookingStatus: string;
  heldPrices: number[];
  paidAmount: number; // Payment.amount in baht
  receivedSatang: number; // what Stripe actually collected
  showtimeStartsAt: Date;
  now: Date;
}): SettlementDecision {
  const {
    bookingStatus,
    heldPrices,
    paidAmount,
    receivedSatang,
    showtimeStartsAt,
    now,
  } = input;

  if (receivedSatang !== toSatang(paidAmount)) {
    return {
      action: "refund",
      reason: "The amount received does not match the booking total.",
    };
  }
  if (bookingStatus !== "PENDING") {
    return {
      action: "refund",
      reason: "This booking was already closed when the payment arrived.",
    };
  }
  if (heldPrices.length === 0) {
    return {
      action: "refund",
      reason: "Your seats were released before the payment arrived.",
    };
  }
  const heldSatang = heldPrices.reduce(
    (sum, price) => sum + toSatang(price),
    0,
  );
  if (heldSatang !== toSatang(paidAmount)) {
    return {
      action: "refund",
      reason:
        "Some of your seats were taken by another customer before the payment arrived.",
    };
  }
  if (showtimeStartsAt <= now) {
    return {
      action: "refund",
      reason: "The showtime had already started when the payment arrived.",
    };
  }
  return { action: "confirm" };
}
