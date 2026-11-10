// src/services/ticket.service.ts
// CineGo — Digital tickets: one ticket (ticketCode + QR payload) per booked seat, and ticket pass queries

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
 * Create one Ticket (its own code and QR) for every seat of a paid booking.
 * Must run inside the payment transaction. Returns how many tickets were created.
 */
export async function createTicketsForBooking(
  tx: Prisma.TransactionClient,
  bookingId: string
): Promise<number> {
  const seats = await tx.bookingSeat.findMany({ where: { bookingId }, select: { id: true } });
  if (seats.length === 0) throw new Error(`Booking ${bookingId} has no seats to issue tickets for`);
  const { count } = await tx.ticket.createMany({
    data: seats.map((bs) => {
      const ticketCode = randomUUID();
      return {
        bookingId,
        bookingSeatId: bs.id,
        ticketCode,
        qrPayload: buildQrPayload(ticketCode),
        status: "ACTIVE" as const,
      };
    }),
  });
  return count;
}

const ticketPassInclude = {
  showtime: {
    include: {
      movie: true,
      screen: { include: { cinema: true } },
    },
  },
  seats: {
    include: { seat: true, ticket: true },
  },
} satisfies Prisma.BookingInclude;

type BookingWithPassData = Prisma.BookingGetPayload<{ include: typeof ticketPassInclude }>;

function toTicketPass(booking: BookingWithPassData): TicketPass {
  const { showtime } = booking;

  const seats = booking.seats
    .filter((bs) => bs.ticket !== null)
    .sort(
      (a, b) =>
        a.seat.rowLabel.localeCompare(b.seat.rowLabel) || a.seat.seatNum - b.seat.seatNum
    )
    .map((bs) => {
      const ticket = bs.ticket!;
      return {
        id: ticket.id,
        ticketCode: ticket.ticketCode,
        qrPayload: ticket.qrPayload,
        status: ticket.status,
        usedAt: ticket.usedAt?.toISOString() ?? null,
        label: `${bs.seat.rowLabel}${bs.seat.seatNum}`,
        tier: getRowTier(bs.seat.rowLabel),
        price: Number(bs.priceAtPurchase),
      };
    });

  const issued = booking.seats
    .flatMap((bs) => (bs.ticket ? [bs.ticket.issuedAt.getTime()] : []))
    .sort((a, b) => a - b)[0];

  return {
    id: booking.id,
    issuedAt: new Date(issued ?? booking.createdAt.getTime()).toISOString(),
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
 * Fetch a booking's tickets (one per seat), only if the booking belongs to the given user
 * and has been paid (its tickets exist).
 */
export async function getTicketPassForUser(
  bookingId: string,
  userId: string
): Promise<TicketPass | null> {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId, tickets: { some: {} } },
    include: ticketPassInclude,
  });

  return booking ? toTicketPass(booking) : null;
}

/**
 * Fetch all of a user's paid bookings (each with its seat tickets), split into
 * upcoming (soonest first) and past (most recent first).
 */
export async function listUserTicketPasses(
  userId: string
): Promise<{ upcoming: TicketPass[]; past: TicketPass[] }> {
  const bookings = await prisma.booking.findMany({
    where: { userId, tickets: { some: {} } },
    include: ticketPassInclude,
    orderBy: { showtime: { startsAt: "desc" } },
  });

  const now = new Date();
  const passes = bookings.map(toTicketPass);
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
  /** The whole booking, so staff can see how many of its seats are already in. */
  ticket?: TicketPass;
  /** The seat this code is for: one QR admits one seat. */
  seat?: string;
  usedAt?: string | null;
}

/** How many of a booking's seats have been admitted. */
export function bookingProgress(pass: TicketPass): { used: number; total: number } {
  return { used: pass.seats.filter((s) => s.status === "USED").length, total: pass.seats.length };
}

/**
 * Validate a scanned/typed code and, if it is good, mark that seat's ticket USED.
 * One ticket = one seat: the booking's other seats stay valid until they are scanned.
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
    include: { booking: { include: ticketPassInclude } },
  });
  if (!ticket) {
    return { outcome: "NOT_FOUND", message: "No ticket exists with this code." };
  }

  const pass = toTicketPass(ticket.booking);
  const seat = pass.seats.find((s) => s.id === ticket.id)?.label;
  const withThisSeatUsed = (usedAt: string | null): TicketPass => ({
    ...pass,
    seats: pass.seats.map((s) => (s.id === ticket.id ? { ...s, status: "USED" as const, usedAt } : s)),
  });

  // Reported before the time window: "already used" is what door staff must know first
  if (ticket.status === "USED") {
    return {
      outcome: "ALREADY_USED",
      message: `Seat ${seat} has already been used.`,
      ticket: pass,
      seat,
      usedAt: ticket.usedAt?.toISOString() ?? null,
    };
  }

  const { startsAt, endsAt } = ticket.booking.showtime;
  if (endsAt.getTime() <= now.getTime()) {
    return { outcome: "SHOW_ENDED", message: "This show has already ended.", ticket: pass, seat };
  }
  if (startsAt.getTime() - now.getTime() > ENTRY_OPENS_MINUTES_BEFORE * 60_000) {
    return {
      outcome: "TOO_EARLY",
      message: `Entry opens ${ENTRY_OPENS_MINUTES_BEFORE} minutes before the show (${formatCinemaDateTime(startsAt)}).`,
      ticket: pass,
      seat,
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
      message: `Seat ${seat} was just scanned at another entrance.`,
      ticket: withThisSeatUsed(latest?.usedAt?.toISOString() ?? null),
      seat,
      usedAt: latest?.usedAt?.toISOString() ?? null,
    };
  }

  const after = withThisSeatUsed(now.toISOString());
  const { used, total } = bookingProgress(after);
  return {
    outcome: "ADMITTED",
    message: `Admit 1: seat ${seat} (${used} of ${total} in this booking now admitted)`,
    ticket: after,
    seat,
    usedAt: now.toISOString(),
  };
}
