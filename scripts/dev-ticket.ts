// scripts/dev-ticket.ts
// DEV ONLY — books a paid ticket for a show starting soon, so the ticket scanner can be tested
// without waiting for the 60-minute entry window (Phase 10 manual testing).
//
// Run:  npm run dev:ticket -- <customer email> [--seats 2] [--within 60]
//
// Uses the app's real flow (holdShowtimeSeats → confirmBookingPayment, the simulated payment),
// so the booking, payment and ticket look exactly like one bought in the browser.

import "dotenv/config";
import prisma from "@/lib/prisma";
import { holdShowtimeSeats } from "@/services/seat.service";
import { confirmBookingPayment } from "@/services/booking.service";
import { ENTRY_OPENS_MINUTES_BEFORE } from "@/services/ticket.service";
import { formatCinemaDateTime, formatCinemaTime } from "@/lib/schedule";

const MINUTE_MS = 60 * 1000;
const MIN_LEAD_MINUTES = 2; // a show starting this soon is too close to book

function fail(message: string): never {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const args = { email: "", seats: 2, within: ENTRY_OPENS_MINUTES_BEFORE };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--seats") args.seats = Number(argv[++i]);
    else if (arg === "--within") args.within = Number(argv[++i]);
    else if (!arg.startsWith("--")) args.email = arg.trim().toLowerCase();
    else fail(`Unknown option ${arg}`);
  }
  if (!args.email) {
    fail("Usage: npm run dev:ticket -- <customer email> [--seats 2] [--within 60]");
  }
  if (!Number.isInteger(args.seats) || args.seats < 1 || args.seats > 10) fail("--seats must be 1–10");
  if (!Number.isInteger(args.within) || args.within < MIN_LEAD_MINUTES) fail("--within must be a whole number of minutes");
  return args;
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    fail("dev:ticket is for local testing only and refuses to run in production.");
  }
  const { email, seats: seatCount, within } = parseArgs(process.argv.slice(2));

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) fail(`No account with email ${email}. Register it in the app first.`);
  if (user.role !== "CUSTOMER") fail(`${email} is ${user.role}; tickets are for customer accounts.`);

  const now = Date.now();
  const candidates = await prisma.showtime.findMany({
    where: {
      startsAt: {
        gt: new Date(now + MIN_LEAD_MINUTES * MINUTE_MS),
        lte: new Date(now + within * MINUTE_MS),
      },
      movie: { isActive: true },
    },
    orderBy: { startsAt: "asc" },
    include: { movie: { select: { title: true } }, screen: true },
  });
  if (candidates.length === 0) {
    fail(
      `No show starts in the next ${within} minutes. Add one in Admin → Showtimes ` +
        `(or try --within 120, but the scanner will say "too early" until ${ENTRY_OPENS_MINUTES_BEFORE} min before).`
    );
  }

  for (const showtime of candidates) {
    // Free = no PAID booking and no live hold on it
    const taken = await prisma.bookingSeat.findMany({
      where: {
        showtimeId: showtime.id,
        OR: [{ booking: { status: "PAID" } }, { heldUntil: { gt: new Date() } }],
      },
      select: { seatId: true },
    });
    const takenIds = new Set(taken.map((t) => t.seatId));
    const free = (
      await prisma.seat.findMany({
        where: { screenId: showtime.screenId },
        orderBy: [{ rowLabel: "desc" }, { seatNum: "asc" }], // back rows first: cheapest
      })
    ).filter((s) => !takenIds.has(s.id));
    if (free.length < seatCount) continue;

    const chosen = free.slice(0, seatCount);
    const hold = await holdShowtimeSeats({
      showtimeId: showtime.id,
      seatIds: chosen.map((s) => s.id),
      userId: user.id,
    });
    if (!hold.success) fail(`Could not hold seats: ${hold.error}`);

    const paid = await confirmBookingPayment({ userId: user.id, showtimeId: showtime.id });
    if (!paid.success) fail(`Could not pay: ${paid.error}`);

    // One ticket (QR) per seat
    const tickets = await prisma.ticket.findMany({
      where: { bookingId: paid.bookingId },
      include: { bookingSeat: { include: { seat: true } } },
    });
    const codes = tickets
      .map((t) => ({ label: `${t.bookingSeat.seat.rowLabel}${t.bookingSeat.seat.seatNum}`, code: t.ticketCode }))
      .sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }))
      .map((t) => `             ${t.label.padEnd(4)} ${t.code}`)
      .join("\n");
    const entryOpens = new Date(showtime.startsAt.getTime() - ENTRY_OPENS_MINUTES_BEFORE * MINUTE_MS);
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

    console.log(`
🎟️  Paid booking created for ${email} (${tickets.length} ${tickets.length === 1 ? "ticket" : "tickets"}, one per seat)

   Movie     ${showtime.movie.title}
   Theatre   ${showtime.screen.name} · ${showtime.screen.format}
   Starts    ${formatCinemaDateTime(showtime.startsAt)}  (entry opens ${formatCinemaTime(entryOpens)})
   Seats     ${chosen.map((s) => `${s.rowLabel}${s.seatNum}`).join(", ")}
   Paid      ฿${paid.amount} (simulated payment)

   Tickets   ${baseUrl}/tickets/${paid.bookingId}   ← open as ${email}, then scan each seat's QR
   Codes     (or type one into the scanner's manual entry)
${codes}
`);
    return;
  }

  fail(`Every show in the next ${within} minutes has fewer than ${seatCount} free seats. Try --seats 1.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
