// src/tests/integration/per-seat-tickets.test.ts
// One ticket (QR) per seat, against the real database: paying for N seats issues N tickets,
// each scanned on its own at the door.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { holdShowtimeSeats } from "@/services/seat.service";
import { confirmBookingPayment } from "@/services/booking.service";
import { getTicketPassForUser, listUserTicketPasses, verifyAndUseTicket } from "@/services/ticket.service";

const stamp = Date.now();
let customer: string;
let stranger: string;
let bookingId: string;
let showtime: { id: string; screenId: string; startsAt: Date };
let atTheDoor: Date;

beforeAll(async () => {
  const found = await prisma.showtime.findFirst({
    where: { startsAt: { gt: new Date(Date.now() + 60 * 60 * 1000) }, movie: { isActive: true } },
    orderBy: { startsAt: "desc" },
    select: { id: true, screenId: true, startsAt: true },
  });
  if (!found) throw new Error("No future showtime found — run the seed script first.");
  showtime = found;
  atTheDoor = new Date(showtime.startsAt.getTime() - 30 * 60 * 1000); // entry is open

  customer = (await prisma.user.create({ data: { email: `seat-tickets-${stamp}@test.cinego.local`, passwordHash: "x" } })).id;
  stranger = (await prisma.user.create({ data: { email: `seat-tickets-other-${stamp}@test.cinego.local`, passwordHash: "x" } })).id;

  const taken = await prisma.bookingSeat.findMany({ where: { showtimeId: showtime.id }, select: { seatId: true } });
  const takenIds = new Set(taken.map((t) => t.seatId));
  const seatIds = (await prisma.seat.findMany({ where: { screenId: showtime.screenId }, orderBy: [{ rowLabel: "desc" }, { seatNum: "asc" }] }))
    .filter((s) => !takenIds.has(s.id))
    .slice(0, 3)
    .map((s) => s.id);
  expect(seatIds).toHaveLength(3);

  const hold = await holdShowtimeSeats({ showtimeId: showtime.id, seatIds, userId: customer });
  expect(hold.success).toBe(true);
  const paid = await confirmBookingPayment({ userId: customer, showtimeId: showtime.id });
  if (!paid.success) throw new Error(`payment failed: ${paid.error}`);
  bookingId = paid.bookingId;
});

afterAll(async () => {
  const userIds = [customer, stranger].filter(Boolean);
  const bookingIds = (await prisma.booking.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((b) => b.id);
  await prisma.ticket.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.bookingSeat.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

async function seatTickets() {
  const pass = await getTicketPassForUser(bookingId, customer);
  expect(pass).not.toBeNull();
  return pass!.seats;
}

describe("one ticket (QR) per seat", () => {
  it("paying for 3 seats issues 3 tickets, each with its own code and seat", async () => {
    const tickets = await prisma.ticket.findMany({ where: { bookingId } });
    expect(tickets).toHaveLength(3);
    expect(new Set(tickets.map((t) => t.ticketCode)).size).toBe(3);
    expect(new Set(tickets.map((t) => t.bookingSeatId)).size).toBe(3);
    for (const t of tickets) expect(t.qrPayload).toBe(`CINEGO:${t.ticketCode}`);

    const seats = await seatTickets();
    expect(seats).toHaveLength(3);
    expect(seats.every((s) => s.status === "ACTIVE")).toBe(true);
  });

  it("the booking's pass is only visible to its owner, and My Tickets lists the booking once", async () => {
    expect(await getTicketPassForUser(bookingId, stranger)).toBeNull();
    const { upcoming } = await listUserTicketPasses(customer);
    expect(upcoming.map((p) => p.id)).toEqual([bookingId]);
    expect(upcoming[0].seats).toHaveLength(3);
  });

  it("scanning one seat admits only that seat; the others stay valid", async () => {
    const [first, second] = await seatTickets();

    const admitted = await verifyAndUseTicket(first.qrPayload, customer, atTheDoor);
    expect(admitted.outcome).toBe("ADMITTED");
    expect(admitted.seat).toBe(first.label);
    expect(admitted.message).toContain("1 of 3");

    const again = await verifyAndUseTicket(first.qrPayload, customer, atTheDoor);
    expect(again.outcome).toBe("ALREADY_USED");
    expect(again.seat).toBe(first.label);

    const next = await verifyAndUseTicket(second.ticketCode, customer, atTheDoor); // typed code works too
    expect(next.outcome).toBe("ADMITTED");
    expect(next.seat).toBe(second.label);
    expect(next.message).toContain("2 of 3");

    const statuses = (await seatTickets()).map((s) => s.status);
    expect(statuses.filter((s) => s === "USED")).toHaveLength(2);
    expect(statuses.filter((s) => s === "ACTIVE")).toHaveLength(1);
  });

  it("the same seat scanned at two entrances at once admits exactly once", async () => {
    const last = (await seatTickets()).find((s) => s.status === "ACTIVE")!;
    const results = await Promise.all([
      verifyAndUseTicket(last.qrPayload, customer, atTheDoor),
      verifyAndUseTicket(last.qrPayload, customer, atTheDoor),
    ]);
    expect(results.filter((r) => r.outcome === "ADMITTED")).toHaveLength(1);
    expect(results.filter((r) => r.outcome === "ALREADY_USED")).toHaveLength(1);
  });
});
