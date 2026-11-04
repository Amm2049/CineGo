// src/services/ticket.service.ts
// CineGo — Digital ticket issuance (ticketCode + QR payload) and ticket pass queries

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getRowTier } from "@/services/seat.service";
import { TicketPass } from "@/types";
import { formatCinemaDateTime } from "@/lib/schedule";

// QR payloads are prefixed so the Phase 8 scanner can reject non-CineGo QR codes
export const QR_PAYLOAD_PREFIX = "CINEGO:";

/**
 * Human-readable booking reference shown on the ticket pass (e.g. "CG-1A2B3C4D").
 */
export function getBookingReference(bookingId: string): string {
  return `CG-${bookingId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function buildQrPayload(ticketCode: string): string {
  return `${QR_PAYLOAD_PREFIX}${ticketCode}`;
}

/**
 * Extract the ticketCode from a scanned QR payload or a manually typed code.
 */
export function parseQrPayload(payload: string): string {
  const trimmed = payload.trim();
  return trimmed.startsWith(QR_PAYLOAD_PREFIX)
    ? trimmed.slice(QR_PAYLOAD_PREFIX.length)
    : trimmed;
}

/**
 * Create the Ticket record for a paid booking. Must run inside the payment transaction.
 */
export async function createTicketForBooking(tx: Prisma.TransactionClient, bookingId: string) {
  const ticketCode = randomUUID();
  return tx.ticket.create({
    data: {
      bookingId,
      ticketCode,
      qrPayload: buildQrPayload(ticketCode),
      status: "ACTIVE",
    },
  });
}

const ticketPassInclude = {
  booking: {
    include: {
      showtime: {
        include: {
          movie: true,
          screen: { include: { cinema: true } },
        },
      },
      seats: {
        include: { seat: true },
      },
    },
  },
} satisfies Prisma.TicketInclude;

type TicketWithPassData = Prisma.TicketGetPayload<{ include: typeof ticketPassInclude }>;

function toTicketPass(ticket: TicketWithPassData): TicketPass {
  const { booking } = ticket;
  const { showtime } = booking;

  const seats = [...booking.seats]
    .sort(
      (a, b) =>
        a.seat.rowLabel.localeCompare(b.seat.rowLabel) || a.seat.seatNum - b.seat.seatNum
    )
    .map((bs) => ({
      label: `${bs.seat.rowLabel}${bs.seat.seatNum}`,
      tier: getRowTier(bs.seat.rowLabel),
      price: Number(bs.priceAtPurchase),
    }));

  return {
    id: ticket.id,
    ticketCode: ticket.ticketCode,
    qrPayload: ticket.qrPayload,
    status: ticket.status,
    issuedAt: ticket.issuedAt.toISOString(),
    bookingReference: getBookingReference(booking.id),
    totalAmount: Number(booking.totalAmount),
    showtime: {
      startsAt: showtime.startsAt.toISOString(),
      endsAt: showtime.endsAt.toISOString(),
      screenName: showtime.screen.name,
      screenNumber: showtime.screen.number,
      screenFormat: showtime.screen.format,
      cinemaName: showtime.screen.cinema.name,
    },
    movie: {
      id: showtime.movie.id,
      title: showtime.movie.title,
      posterUrl: showtime.movie.posterUrl,
      duration: showtime.movie.duration,
    },
    seats,
  };
}

/**
 * Fetch a single ticket pass, only if it belongs to the given user.
 */
export async function getTicketPassForUser(
  ticketId: string,
  userId: string
): Promise<TicketPass | null> {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, booking: { userId } },
    include: ticketPassInclude,
  });

  return ticket ? toTicketPass(ticket) : null;
}

/**
 * Fetch all of a user's tickets split into upcoming (soonest first) and past (most recent first).
 */
export async function listUserTicketPasses(
  userId: string
): Promise<{ upcoming: TicketPass[]; past: TicketPass[] }> {
  const tickets = await prisma.ticket.findMany({
    where: { booking: { userId } },
    include: ticketPassInclude,
    orderBy: { booking: { showtime: { startsAt: "desc" } } },
  });

  const now = new Date();
  const passes = tickets.map(toTicketPass);
  return {
    upcoming: passes.filter((t) => new Date(t.showtime.endsAt) > now).reverse(),
    past: passes.filter((t) => new Date(t.showtime.endsAt) <= now),
  };
}

// ── Phase 8: door scanning ─────────────────────────────────

const TICKET_CODE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ticket codes are UUIDs (crypto.randomUUID). Anything else is not ours. */
export function isValidTicketCode(code: string): boolean {
  return TICKET_CODE_PATTERN.test(code);
}

export const ENTRY_OPENS_MINUTES_BEFORE = 60;

export type VerifyTicketOutcome =
  | "ADMITTED"
  | "ALREADY_USED"
  | "NOT_FOUND"
  | "INVALID_CODE"
  | "TOO_EARLY"
  | "SHOW_ENDED";

export interface VerifyTicketResult {
  outcome: VerifyTicketOutcome;
  message: string;
  ticket?: TicketPass;
  usedAt?: string | null;
}

/**
 * Validate a scanned/typed code and, if it is good, mark the ticket USED.
 * `scannedById` is the logged-in ADMIN/STAFF user (audit trail).
 * `now` is a parameter so tests can stand "at the door" before the show.
 */
export async function verifyAndUseTicket(
  rawInput: string,
  scannedById: string,
  now: Date = new Date()
): Promise<VerifyTicketResult> {
  const ticketCode = parseQrPayload(rawInput).toLowerCase();
  if (!isValidTicketCode(ticketCode)) {
    // A restaurant-menu QR never costs a database query
    return { outcome: "INVALID_CODE", message: "This is not a CineGo ticket." };
  }

  const ticket = await prisma.ticket.findUnique({
    where: { ticketCode },
    include: ticketPassInclude,
  });
  if (!ticket) {
    return { outcome: "NOT_FOUND", message: "No ticket exists with this code." };
  }

  const pass = toTicketPass(ticket);

  // Reported before the time window: "already used" is what door staff must know first
  if (ticket.status === "USED") {
    return {
      outcome: "ALREADY_USED",
      message: "This ticket has already been used.",
      ticket: pass,
      usedAt: ticket.usedAt?.toISOString() ?? null,
    };
  }

  const { startsAt, endsAt } = ticket.booking.showtime;
  if (endsAt.getTime() <= now.getTime()) {
    return { outcome: "SHOW_ENDED", message: "This show has already ended.", ticket: pass };
  }
  if (startsAt.getTime() - now.getTime() > ENTRY_OPENS_MINUTES_BEFORE * 60_000) {
    return {
      outcome: "TOO_EARLY",
      message: `Entry opens ${ENTRY_OPENS_MINUTES_BEFORE} minutes before the show (${formatCinemaDateTime(startsAt)}).`,
      ticket: pass,
    };
  }

  // Compare-and-set: only flips ACTIVE -> USED in ONE statement.
  // If another gate got there first, its UPDATE already changed the status and ours matches 0 rows.
  const { count } = await prisma.ticket.updateMany({
    where: { id: ticket.id, status: "ACTIVE" },
    data: { status: "USED", usedAt: now, scannedById },
  });

  if (count === 0) {
    const latest = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { usedAt: true },
    });
    return {
      outcome: "ALREADY_USED",
      message: "This ticket was just scanned at another entrance.",
      ticket: { ...pass, status: "USED" },
      usedAt: latest?.usedAt?.toISOString() ?? null,
    };
  }

  const seatList = pass.seats.map((s) => s.label).join(", ");
  return {
    outcome: "ADMITTED",
    message: `Admit ${pass.seats.length}: ${seatList}`,
    ticket: { ...pass, status: "USED" },
    usedAt: now.toISOString(),
  };
}
