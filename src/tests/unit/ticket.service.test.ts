// src/tests/unit/ticket.service.test.ts
import { describe, it, expect } from "vitest";
import {
  bookingProgress,
  buildQrPayload,
  getBookingReference,
  isValidTicketCode,
  parseQrPayload,
  QR_PAYLOAD_PREFIX,
} from "@/services/ticket.service";

describe("Ticket Service Helpers", () => {
  it("builds a short uppercase booking reference from the booking id", () => {
    expect(getBookingReference("1a2b3c4d-5e6f-7a8b-9c0d-112233445566")).toBe("CG-1A2B3C4D");
  });

  it("prefixes QR payloads so the scanner can recognise CineGo tickets", () => {
    expect(buildQrPayload("abc-123")).toBe(`${QR_PAYLOAD_PREFIX}abc-123`);
  });

  it("round-trips a ticket code through the QR payload", () => {
    const code = "6f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f";
    expect(parseQrPayload(buildQrPayload(code))).toBe(code);
  });

  it("accepts a manually typed ticket code without the prefix", () => {
    expect(parseQrPayload("  abc-123  ")).toBe("abc-123");
  });
});

describe("isValidTicketCode", () => {
  it("accepts a UUID, in any letter case", () => {
    expect(isValidTicketCode("6f1c2d3e-4a5b-4c6d-8e7f-001122334455")).toBe(true);
    expect(isValidTicketCode("6F1C2D3E-4A5B-4C6D-8E7F-001122334455")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isValidTicketCode("https://example.com/menu")).toBe(false);
    expect(isValidTicketCode("CINEGO:not-a-uuid")).toBe(false);
    expect(isValidTicketCode("")).toBe(false);
  });
});

describe("bookingProgress (one ticket per seat)", () => {
  const seat = (label: string, status: "ACTIVE" | "USED") => ({
    id: label, ticketCode: label, qrPayload: label, status, usedAt: null, label, tier: "STANDARD" as const, price: 150,
  });
  const pass = (seats: ReturnType<typeof seat>[]) =>
    ({ seats } as unknown as Parameters<typeof bookingProgress>[0]);

  it("counts how many of the booking's seats are in", () => {
    expect(bookingProgress(pass([seat("F5", "USED"), seat("F6", "ACTIVE"), seat("F7", "ACTIVE")]))).toEqual({ used: 1, total: 3 });
  });
  it("is 0 of N before anyone is scanned", () => {
    expect(bookingProgress(pass([seat("A1", "ACTIVE"), seat("A2", "ACTIVE")]))).toEqual({ used: 0, total: 2 });
  });
});
