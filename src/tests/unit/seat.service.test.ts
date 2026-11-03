// src/tests/unit/seat.service.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { Prisma } from "@prisma/client";
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

  it("rejects seat hold when seatIds is empty", async () => {
    const { holdShowtimeSeats } = await import("@/services/seat.service");
    const result = await holdShowtimeSeats({
      showtimeId: "test-st-1",
      seatIds: [],
      userId: "test-user-1",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("No seats selected");
  });
});

describe("holdShowtimeSeats error handling", () => {
  const params = { showtimeId: "st-1", seatIds: ["seat-1"], userId: "user-1" };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["P2002", "P2034"])(
    "treats %s as an expected seat conflict: short warning, no stack trace",
    async (code) => {
      const { holdShowtimeSeats } = await import("@/services/seat.service");
      const { default: prisma } = await import("@/lib/prisma");
      vi.spyOn(prisma, "$transaction").mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("conflict", { code, clientVersion: "test" })
      );
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const error = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await holdShowtimeSeats(params);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/just taken by another customer/);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain(code);
      expect(error).not.toHaveBeenCalled();
    }
  );

  it("logs unexpected errors in full", async () => {
    const { holdShowtimeSeats } = await import("@/services/seat.service");
    const { default: prisma } = await import("@/lib/prisma");
    vi.spyOn(prisma, "$transaction").mockRejectedValue(new Error("connection lost"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await holdShowtimeSeats(params);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Could not reserve your seats. Please try again.");
    expect(error).toHaveBeenCalledTimes(1);
  });
});

