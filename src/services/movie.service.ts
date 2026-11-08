// src/services/movie.service.ts
// CineGo -- Reusable Movie Data Access Service Layer

import prisma from "@/lib/prisma";
import { cinemaDayOf } from "@/lib/schedule";
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
      isActive: true,
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
        orderBy: { startsAt: "asc" }, // the next show first, never an arbitrary one
        include: { screen: true },
        ...(params?.limit ? { take: 5 } : {}),
      },
    },
    orderBy: { releaseDate: "desc" },
    ...(params?.limit ? { take: params.limit } : {}),
  });
}

/**
 * Movie page: an active movie and its bookable showtimes (not started yet, earliest first) for the
 * showtime picker. Seats taken = sold + currently held, so "seats left" matches the seat map.
 * Returns null for unknown or hidden (inactive) movies.
 */
export async function getMovieWithShowtimes(movieId: string, now: Date = new Date()) {
  const movie = await prisma.movie.findFirst({
    where: { id: movieId, isActive: true },
    include: {
      genres: { include: { genre: true } },
      showtimes: {
        where: { startsAt: { gt: now } },
        orderBy: { startsAt: "asc" },
        include: {
          screen: {
            select: { id: true, name: true, number: true, format: true, _count: { select: { seats: true } } },
          },
          _count: {
            select: {
              seats: { where: { OR: [{ booking: { status: "PAID" } }, { heldUntil: { gt: now } }] } },
            },
          },
        },
      },
    },
  });
  if (!movie) return null;

  return {
    movie: {
      id: movie.id,
      title: movie.title,
      description: movie.description,
      posterUrl: movie.posterUrl,
      backdropUrl: movie.backdropUrl,
      duration: movie.duration,
      releaseDate: movie.releaseDate.toISOString(),
      genres: movie.genres.map((g) => g.genre.name),
    },
    showtimes: movie.showtimes.map((s) => ({
      id: s.id,
      startsAt: s.startsAt.toISOString(),
      day: cinemaDayOf(s.startsAt), // Bangkok calendar day, for the date strip
      screenName: s.screen.name,
      screenNumber: s.screen.number,
      screenFormat: s.screen.format,
      seatsLeft: Math.max(0, s.screen._count.seats - s._count.seats),
    })),
  };
}

export type MovieShowtimeOption = NonNullable<
  Awaited<ReturnType<typeof getMovieWithShowtimes>>
>["showtimes"][number];

/**
 * Fetch upcoming movie releases (releaseDate in the future).
 */
export async function getUpcomingMovies(params?: MovieQueryParams) {
  const now = new Date();

  return prisma.movie.findMany({
    where: {
      isActive: true,
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
type CatalogRawMovie =
  | Awaited<ReturnType<typeof getNowShowingMovies>>[number]
  | Awaited<ReturnType<typeof getUpcomingMovies>>[number];

export function formatCatalogMovie(
  movie: CatalogRawMovie,
  isUpcoming: boolean,
): MovieItem {
  const screens =
    "showtimes" in movie && Array.isArray(movie.showtimes)
      ? (movie.showtimes as Array<{ screen?: { format?: string } | null }>)
          .map((s) => s.screen?.format)
          .filter((format): format is string => Boolean(format))
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
  const upcoming = upcomingRaw.map((m) => formatCatalogMovie(m, true));

  return { nowShowing, upcoming };
}
