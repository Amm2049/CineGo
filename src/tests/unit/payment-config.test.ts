// src/tests/unit/payment-config.test.ts
// Phase 9: provider switch, the 10 + 2 minute payment window, and the confirm-or-refund rule
import { describe, it, expect } from "vitest";
import {
  PAYMENT_GRACE_MS,
  PAYMENT_WINDOW_MS,
  decideSettlement,
  getPaymentProvider,
  getPaymentWindow,
  toSatang,
} from "@/lib/payment-config";
import { isTestModeKey } from "@/lib/stripe";

describe("getPaymentProvider", () => {
  it("uses Stripe only when explicitly asked", () => {
    expect(getPaymentProvider("stripe")).toBe("stripe");
    expect(getPaymentProvider(" Stripe ")).toBe("stripe");
  });

  it("falls back to the simulated payment (CI, offline demos)", () => {
    expect(getPaymentProvider(undefined)).toBe("simulated");
    expect(getPaymentProvider("")).toBe("simulated");
    expect(getPaymentProvider("simulated")).toBe("simulated");
    expect(getPaymentProvider("omise")).toBe("simulated");
  });
});

describe("getPaymentWindow", () => {
  it("gives 10 minutes to pay and holds the seats 2 minutes longer", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    const { expiresAt, holdUntil } = getPaymentWindow(now);
    expect(PAYMENT_WINDOW_MS).toBe(10 * 60 * 1000);
    expect(PAYMENT_GRACE_MS).toBe(2 * 60 * 1000);
    expect(expiresAt.toISOString()).toBe("2026-11-05T12:10:00.000Z");
    expect(holdUntil.toISOString()).toBe("2026-11-05T12:12:00.000Z");
  });
});

describe("toSatang", () => {
  it("converts baht to Stripe's smallest unit without float drift", () => {
    expect(toSatang(280)).toBe(28000);
    expect(toSatang(0.1 + 0.2)).toBe(30);
  });
});

describe("decideSettlement", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  const base = {
    bookingStatus: "PENDING",
    heldPrices: [280, 200],
    paidAmount: 480,
    receivedSatang: 48000,
    showtimeStartsAt: new Date("2026-11-05T15:00:00Z"),
    now,
  };

  it("confirms when the booking still owns every seat it paid for", () => {
    expect(decideSettlement(base)).toEqual({ action: "confirm" });
  });

  it("refunds when another customer took one of the seats", () => {
    expect(decideSettlement({ ...base, heldPrices: [280] }).action).toBe("refund");
  });

  it("refunds when all seats were released", () => {
    expect(decideSettlement({ ...base, heldPrices: [] }).action).toBe("refund");
  });

  it("refunds when the booking was already closed", () => {
    expect(decideSettlement({ ...base, bookingStatus: "EXPIRED" }).action).toBe("refund");
  });

  it("refunds when Stripe collected a different amount", () => {
    expect(decideSettlement({ ...base, receivedSatang: 47999 }).action).toBe("refund");
  });

  it("refunds when the showtime has started", () => {
    expect(decideSettlement({ ...base, showtimeStartsAt: now }).action).toBe("refund");
  });
});

describe("isTestModeKey", () => {
  it("accepts only test-mode keys", () => {
    expect(isTestModeKey("sk_test_123")).toBe(true);
    expect(isTestModeKey("rk_test_123")).toBe(true);
    expect(isTestModeKey("sk_live_123")).toBe(false);
    expect(isTestModeKey("pk_test_123")).toBe(false);
  });
});
