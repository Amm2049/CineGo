// src/services/ticket.service.ts
// CineGo — Digital ticket issuance (ticketCode + QR payload) and ticket pass queries

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getRowTier } from "@/services/seat.service";
import { TicketPass } from "@/types";

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
