// src/services/movie.service.ts
// CineGo -- Reusable Movie Data Access Service Layer

import prisma from "@/lib/prisma";
import { MovieItem } from "@/types";

export interface MovieQueryParams {
  limit?: number;
}

/**
 * Fetch movies currently showing in theaters (released with at least one active future showtime).
 */
export async function getNowShowingMovies(params?: MovieQueryParams) {
  const now = new Date();

  return prisma.movie.findMany({
    where: {
      releaseDate: { lte: now },
      showtimes: {
        some: {
          startsAt: { gte: now },
        },
      },
    },
    include: {
      genres: {
        include: { genre: true },
      },
      showtimes: {
        where: { startsAt: { gte: now } },
        include: { screen: true },
        ...(params?.limit ? { take: 5 } : {}),
      },
    },
    orderBy: { releaseDate: "desc" },
    ...(params?.limit ? { take: params.limit } : {}),
  });
}

/**
 * Fetch upcoming movie releases (releaseDate in the future).
 */
export async function getUpcomingMovies(params?: MovieQueryParams) {
  const now = new Date();

  return prisma.movie.findMany({
    where: {
      releaseDate: { gt: now },
    },
    include: {
      genres: {
        include: { genre: true },
      },
    },
    orderBy: { releaseDate: "asc" },
    ...(params?.limit ? { take: params.limit } : {}),
  });
}

/**
 * Format raw Prisma movie data into a lightweight MovieItem for catalog and client views.
 */
export function formatCatalogMovie(
  movie: Awaited<ReturnType<typeof getNowShowingMovies>>[number],
  isUpcoming: boolean
): MovieItem {
  const screens =
    "showtimes" in movie && Array.isArray(movie.showtimes)
      ? movie.showtimes
          .map((s) => s.screen?.name)
          .filter((name): name is string => Boolean(name))
      : [];

  const uniqueFormats = Array.from(new Set(screens));

  return {
    id: movie.id,
    title: movie.title,
    description: movie.description,
    posterUrl: movie.posterUrl,
    backdropUrl: movie.backdropUrl,
    duration: movie.duration,
    releaseDate: movie.releaseDate.toISOString(),
    genres: movie.genres.map((g) => g.genre.name),
    formats: uniqueFormats.length > 0 ? uniqueFormats : ["Digital 4K"],
    isUpcoming,
  };
}

/**
 * Helper to fetch both Now Showing and Upcoming movies concurrently and formatted.
 */
export async function getFormattedCatalogMovies() {
  const [nowShowingRaw, upcomingRaw] = await Promise.all([
    getNowShowingMovies(),
    getUpcomingMovies(),
  ]);

  const nowShowing = nowShowingRaw.map((m) => formatCatalogMovie(m, false));
  const upcoming = upcomingRaw.map((m) => formatCatalogMovie(m as any, true));

  return { nowShowing, upcoming };
}
