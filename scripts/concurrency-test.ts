// scripts/concurrency-test.ts
// Phase 7 verification: fires concurrent seat holds and payments against the real database
// and asserts PostgreSQL never allows a seat to be held or booked twice.
// Creates throwaway users and removes everything it created when finished.
//
// Run: npm run test:concurrency

import "dotenv/config";
import prisma from "@/lib/prisma";
import { holdShowtimeSeats } from "@/services/seat.service";
import { confirmBookingPayment } from "@/services/booking.service";
import { verifyAndUseTicket } from "@/services/ticket.service";

const RUN_ID = `concurrency-${Date.now()}`;
const ROUNDS = 5;
const USERS = 4;

let failures = 0;

function check(label: string, condition: boolean, detail = "") {
  console.log(`${condition ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures++;
}

async function findFreeSeats(showtimeId: string, screenId: string, count: number) {
  const taken = await prisma.bookingSeat.findMany({
    where: { showtimeId },
    select: { seatId: true },
  });
  const takenIds = new Set(taken.map((t) => t.seatId));
  const seats = await prisma.seat.findMany({
    where: { screenId },
    orderBy: [{ rowLabel: "desc" }, { seatNum: "desc" }],
  });
  return seats.filter((s) => !takenIds.has(s.id)).slice(0, count);
}

async function main() {
  const showtime = await prisma.showtime.findFirst({
    where: { startsAt: { gt: new Date(Date.now() + 60 * 60 * 1000) } },
    orderBy: { startsAt: "desc" },
  });
  if (!showtime) throw new Error("No future showtime found — run the seed script first.");

  const users = await Promise.all(
    Array.from({ length: USERS }, (_, i) =>
      prisma.user.create({
        data: {
          email: `${RUN_ID}-${i}@test.cinego.local`,
          passwordHash: "not-a-real-hash",
          name: `Concurrency Test ${i}`,
        },
      })
    )
  );
  const userIds = users.map((u) => u.id);

  try {
    const seats = await findFreeSeats(showtime.id, showtime.screenId, ROUNDS + 2);
    if (seats.length < ROUNDS + 2) throw new Error("Not enough free seats on the test showtime.");

    console.log(`\nShowtime ${showtime.id} — ${USERS} users racing per round\n`);

    // 1. Concurrent holds on the same seat: exactly one user may win each round
    for (let round = 0; round < ROUNDS; round++) {
      const seatId = seats[round].id;
      const results = await Promise.all(
        userIds.map((userId) =>
          holdShowtimeSeats({ showtimeId: showtime.id, seatIds: [seatId], userId })
        )
      );
      const winners = results.filter((r) => r.success).length;
      const rows = await prisma.bookingSeat.count({ where: { showtimeId: showtime.id, seatId } });
      check(`Hold race round ${round + 1}: exactly one winner`, winners === 1, `${winners} won`);
      check(`Hold race round ${round + 1}: one BookingSeat row`, rows === 1, `${rows} rows`);

      // Clear this round's hold so the next round starts clean
      await prisma.bookingSeat.deleteMany({ where: { showtimeId: showtime.id, seatId } });
    }

    // 2. Double-submitted payment: only one PAID booking and one ticket
    const paySeat = seats[ROUNDS];
    const [payer, rival] = userIds;
    const hold = await holdShowtimeSeats({
      showtimeId: showtime.id,
      seatIds: [paySeat.id],
      userId: payer,
    });
    check("Payer holds seat before paying", hold.success);

    const payments = await Promise.all([
      confirmBookingPayment({ userId: payer, showtimeId: showtime.id }),
      confirmBookingPayment({ userId: payer, showtimeId: showtime.id }),
    ]);
    const paid = payments.filter((p) => p.success).length;
    const tickets = await prisma.ticket.count({ where: { booking: { userId: payer } } });
    check("Double payment: exactly one succeeds", paid === 1, `${paid} succeeded`);
    check("Double payment: one ticket per seat (1 seat, 1 ticket)", tickets === 1, `${tickets} tickets`);

    // 3. A paid seat can't be held by anyone else
    const steal = await holdShowtimeSeats({
      showtimeId: showtime.id,
      seatIds: [paySeat.id],
      userId: rival,
    });
    check("Rival cannot hold a PAID seat", !steal.success, steal.error);

    // 5. One ticket scanned at two entrances at once: exactly one admission (Phase 8)
    const paidTicket = await prisma.ticket.findFirst({ where: { booking: { userId: payer } } });
    if (paidTicket) {
      const atTheDoor = new Date(showtime.startsAt.getTime() - 10 * 60 * 1000); // 10 min before start
      const scans = await Promise.all([
        // Any existing user id satisfies the scannedById foreign key in this test
        verifyAndUseTicket(paidTicket.qrPayload, payer, atTheDoor),
        verifyAndUseTicket(paidTicket.qrPayload, payer, atTheDoor),
      ]);
      const admitted = scans.filter((s) => s.outcome === "ADMITTED").length;
      check("Double scan: exactly one entrance admits", admitted === 1, `${admitted} admitted`);
      const audited = await prisma.ticket.findUnique({
        where: { id: paidTicket.id },
        select: { scannedById: true },
      });
      check("Double scan: scanner recorded", audited?.scannedById === payer);
    } else {
      check("Double scan: paid ticket exists", false);
    }

    // 4. An expired hold can't be paid for
    const expiredSeat = seats[ROUNDS + 1];
    await holdShowtimeSeats({ showtimeId: showtime.id, seatIds: [expiredSeat.id], userId: rival });
    await prisma.bookingSeat.updateMany({
      where: { showtimeId: showtime.id, seatId: expiredSeat.id },
      data: { heldUntil: new Date(Date.now() - 1000) },
    });
    const expiredPay = await confirmBookingPayment({ userId: rival, showtimeId: showtime.id });
    check("Expired hold cannot be paid", !expiredPay.success, expiredPay.success ? "" : expiredPay.error);
  } finally {
    // Remove everything created by this run
    const bookingIds = (
      await prisma.booking.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
    ).map((b) => b.id);
    await prisma.ticket.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.bookingSeat.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    console.log("\n🧹 Cleaned up test users, bookings, payments, and tickets.");
  }

  console.log(failures === 0 ? "\n🎉 All concurrency checks passed." : `\n💥 ${failures} check(s) failed.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
