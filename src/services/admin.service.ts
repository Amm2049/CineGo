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
