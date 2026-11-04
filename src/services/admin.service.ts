// src/services/admin.service.ts
// CineGo — admin-only queries and updates

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

// ── Movies ─────────────────────────────────────────────────

export async function listAdminMovies() {
  const now = new Date();
  const movies = await prisma.movie.findMany({
    orderBy: [{ isActive: "desc" }, { releaseDate: "desc" }],
    include: {
      _count: { select: { showtimes: { where: { startsAt: { gte: now } } } } },
    },
  });

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

export async function getDashboardStats() {
  const now = new Date();

  // Six independent queries in parallel: on Neon each round trip is noticeable
  const [activeMovies, upcomingShowtimes, revenue, ticketsSold, ticketsUsed, recentPayments] =
    await Promise.all([
      prisma.movie.count({ where: { isActive: true } }),
      prisma.showtime.count({ where: { startsAt: { gte: now } } }),
      // Revenue = money actually paid, not Booking.totalAmount (PENDING bookings have totals too)
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
    activeMovies,
    upcomingShowtimes,
    totalRevenue: Number(revenue._sum.amount ?? 0), // _sum is null when there are no payments
    ticketsSold,
    ticketsUsed,
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      email: p.booking.user.email,
      movieTitle: p.booking.showtime.movie.title,
      seats: p.booking._count.seats,
      amount: Number(p.amount),
      paidAt: p.paidAt.toISOString(),
    })),
  };
}
