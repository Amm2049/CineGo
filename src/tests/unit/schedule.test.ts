// src/tests/unit/schedule.test.ts
import { describe, it, expect } from "vitest";
import {
  addCinemaDays,
  cinemaDayOf,
  cinemaLocalToDate,
  formatCinemaDayLabel,
  computeEndsAt,
  formatCinemaTime,
  rangesOverlap,
  todayInCinemaTz,
} from "@/lib/schedule";

const t = (hhmm: string) => cinemaLocalToDate(`2026-11-05T${hhmm}`);

describe("rangesOverlap (25-minute buffer)", () => {
  it("allows a show that starts after the buffer", () => {
    expect(rangesOverlap(t("16:30"), t("18:30"), t("14:00"), t("16:00"))).toBe(false);
  });
  it("rejects a show that starts inside the buffer", () => {
    expect(rangesOverlap(t("16:15"), t("18:15"), t("14:00"), t("16:00"))).toBe(true);
  });
  it("rejects a show whose buffer runs into the next show", () => {
    expect(rangesOverlap(t("11:00"), t("13:40"), t("14:00"), t("16:00"))).toBe(true);
  });
  it("rejects a show that covers another", () => {
    expect(rangesOverlap(t("13:00"), t("17:00"), t("14:00"), t("16:00"))).toBe(true);
  });
});

describe("time-zone helpers", () => {
  it("reads datetime-local input as Bangkok time", () => {
    expect(cinemaLocalToDate("2026-11-05T19:30").toISOString()).toBe("2026-11-05T12:30:00.000Z");
  });
  it("computes the end from the runtime", () => {
    expect(computeEndsAt(t("19:30"), 150).toISOString()).toBe("2026-11-05T15:00:00.000Z");
  });
  it("uses the Bangkok calendar day", () => {
    // 20:00 UTC on 4 Nov is already 03:00 on 5 Nov in Bangkok
    expect(todayInCinemaTz(new Date("2026-11-04T20:00:00Z"))).toBe("2026-11-05");
  });
  it("formats times in Bangkok whatever the machine's zone", () => {
    expect(formatCinemaTime("2026-11-05T12:30:00.000Z")).toBe("19:30");
  });
});

describe("showtime picker day helpers (Bangkok calendar)", () => {
  it("puts a late-night Bangkok show on its Bangkok day, not the UTC day", () => {
    // 23:30 Bangkok on 10 Nov = 16:30 UTC on 10 Nov; 01:00 Bangkok on 11 Nov = 18:00 UTC on 10 Nov
    expect(cinemaDayOf(cinemaLocalToDate("2026-11-10T23:30"))).toBe("2026-11-10");
    expect(cinemaDayOf(cinemaLocalToDate("2026-11-11T01:00"))).toBe("2026-11-11");
  });

  it("adds days across month and year ends", () => {
    expect(addCinemaDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addCinemaDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("labels today and tomorrow, otherwise weekday + date", () => {
    const now = cinemaLocalToDate("2026-11-08T23:50"); // late evening in Bangkok
    expect(formatCinemaDayLabel("2026-11-08", now)).toBe("Today");
    expect(formatCinemaDayLabel("2026-11-09", now)).toBe("Tomorrow");
    expect(formatCinemaDayLabel("2026-11-10", now)).toBe("Tue 10 Nov");
  });
});
