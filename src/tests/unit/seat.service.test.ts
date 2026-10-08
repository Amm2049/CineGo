// src/tests/unit/seat.service.test.ts
import { describe, it, expect } from "vitest";
import { getRowTier, HOLD_DURATION_MS } from "@/services/seat.service";

describe("Seat Service Tier Calculations", () => {
  it("correctly identifies VIP rows", () => {
    expect(getRowTier("A")).toBe("VIP");
    expect(getRowTier("B")).toBe("VIP");
    expect(getRowTier("a")).toBe("VIP");
    expect(getRowTier("b")).toBe("VIP");
  });

  it("correctly identifies Premium rows", () => {
    expect(getRowTier("C")).toBe("PREMIUM");
    expect(getRowTier("D")).toBe("PREMIUM");
    expect(getRowTier("c")).toBe("PREMIUM");
    expect(getRowTier("d")).toBe("PREMIUM");
  });

  it("correctly identifies Standard rows", () => {
    expect(getRowTier("E")).toBe("STANDARD");
    expect(getRowTier("F")).toBe("STANDARD");
    expect(getRowTier("G")).toBe("STANDARD");
    expect(getRowTier("e")).toBe("STANDARD");
  });

  it("has a 5-minute hold duration", () => {
    expect(HOLD_DURATION_MS).toBe(5 * 60 * 1000);
  });
});
