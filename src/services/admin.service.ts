// src/services/admin.service.ts
// CineGo — admin-only queries and updates

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { CINEMA_UTC_OFFSET, todayInCinemaTz } from "@/lib/schedule";

// ── Movies ─────────────────────────────────────────────────

export async function listAdminMovies() {
  const now = new Date();
  const [movies, paidUpcoming] = await Promise.all([
    prisma.movie.findMany({
      orderBy: [{ isActive: "desc" }, { releaseDate: "desc" }],
      include: {
        _count: { select: { showtimes: { where: { startsAt: { gte: now } } } } },
      },
    }),
    // Paid bookings for shows that haven't started: what deactivating a movie would affect
    prisma.booking.findMany({
      where: { status: "PAID", showtime: { startsAt: { gte: now } } },
      select: { showtime: { select: { movieId: true } }, _count: { select: { seats: true } } },
    }),
  ]);

  const sold = new Map<string, { tickets: number; seats: number }>();
  for (const b of paidUpcoming) {
    const entry = sold.get(b.showtime.movieId) ?? { tickets: 0, seats: 0 };
    entry.tickets += 1; // one ticket (QR) per booking
    entry.seats += b._count.seats;
    sold.set(b.showtime.movieId, entry);
  }

  // Plain JSON for client components
  return movies.map((m) => ({
    id: m.id,
    tmdbId: m.tmdbId,
    title: m.title,
    description: m.description,
    posterUrl: m.posterUrl,
    releaseDate: m.releaseDate.toISOString(),
    duration: m.duration,
    isActive: m.isActive,
    upcomingShowtimes: m._count.showtimes,
    upcomingTicketsSold: sold.get(m.id)?.tickets ?? 0,
    upcomingSeatsSold: sold.get(m.id)?.seats ?? 0,
  }));
}

export type AdminMovieRow = Awaited<ReturnType<typeof listAdminMovies>>[number];

export interface AdminMovieUpdate {
  title?: string;
  description?: string;
  isActive?: boolean;
}

/** Returns the updated movie, or null if the id does not exist. */
export async function updateAdminMovie(id: string, data: AdminMovieUpdate) {
  try {
    return await prisma.movie.update({
      where: { id },
      data,
      select: { id: true, title: true, description: true, isActive: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null; // P2025 = record to update not found
    }
    throw error;
  }
}

// ── Dashboard ──────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Admin landing page. "Today" (Bangkok calendar day) comes first because that is what an admin
 * acts on; all-time totals stay below as context.
 */
export async function getDashboardStats(now: Date = new Date()) {
  const dayStart = new Date(`${todayInCinemaTz(now)}T00:00:00${CINEMA_UTC_OFFSET}`);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);
  const todayShows = { startsAt: { gte: dayStart, lt: dayEnd } };

  // Independent queries in parallel: on Neon each round trip is noticeable
  const [
    revenueToday,
    bookingsToday,
    seatsSoldToday,
    showsToday,
    admittedToday,
    ticketsForTodaysShows,
    upNext,
    activeMovies,
    upcomingShowtimes,
    revenue,
    ticketsSold,
    ticketsUsed,
    recentPayments,
  ] = await Promise.all([
    // Revenue = money actually paid, not Booking.totalAmount (PENDING bookings have totals too)
    prisma.payment.aggregate({
      where: { status: "SUCCESS", paidAt: { gte: dayStart, lt: dayEnd } },
      _sum: { amount: true },
    }),
    prisma.booking.count({
      where: { status: "PAID", payment: { status: "SUCCESS", paidAt: { gte: dayStart, lt: dayEnd } } },
    }),
    prisma.bookingSeat.count({
      where: { booking: { status: "PAID", payment: { status: "SUCCESS", paidAt: { gte: dayStart, lt: dayEnd } } } },
    }),
    prisma.showtime.count({ where: todayShows }),
    prisma.ticket.count({ where: { status: "USED", booking: { showtime: todayShows } } }),
    prisma.ticket.count({ where: { booking: { showtime: todayShows } } }),
    prisma.showtime.findMany({
      where: { startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 5,
      include: {
        movie: { select: { title: true } },
        screen: { select: { name: true, format: true, _count: { select: { seats: true } } } },
        _count: { select: { seats: { where: { booking: { status: "PAID" } } } } },
      },
    }),
    prisma.movie.count({ where: { isActive: true } }),
    prisma.showtime.count({ where: { startsAt: { gte: now } } }),
    prisma.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
    prisma.ticket.count(),
    prisma.ticket.count({ where: { status: "USED" } }),
    prisma.payment.findMany({
      where: { status: "SUCCESS" },
      orderBy: { paidAt: "desc" },
      take: 5,
      include: {
        booking: {
          include: {
            user: { select: { email: true } },
            showtime: { select: { movie: { select: { title: true } } } },
            _count: { select: { seats: true } },
          },
        },
      },
    }),
  ]);

  return {
    day: todayInCinemaTz(now),
    today: {
      revenue: Number(revenueToday._sum.amount ?? 0), // _sum is null when there are no payments
      bookings: bookingsToday, // one ticket (QR) per booking
      seatsSold: seatsSoldToday,
      shows: showsToday,
      admitted: admittedToday,
      ticketsForTodaysShows,
    },
    upNext: upNext.map((s) => ({
      id: s.id,
      movieTitle: s.movie.title,
      screenName: s.screen.name,
      screenFormat: s.screen.format,
      startsAt: s.startsAt.toISOString(),
      seatsSold: s._count.seats,
      capacity: s.screen._count.seats,
    })),
    activeMovies,
    upcomingShowtimes,
    totalRevenue: Number(revenue._sum.amount ?? 0),
    ticketsSold,
    ticketsUsed,
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      email: p.booking.user.email,
      movieTitle: p.booking.showtime.movie.title,
      seats: p.booking._count.seats,
      amount: Number(p.amount),
      paidAt: (p.paidAt ?? p.createdAt).toISOString(), // SUCCESS payments always have paidAt
    })),
  };
}
