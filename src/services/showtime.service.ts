// src/services/showtime.service.ts
// CineGo — admin showtime scheduling with conflict-free screens

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  CINEMA_UTC_OFFSET,
  CLEANING_BUFFER_MINUTES,
  computeEndsAt,
  formatCinemaTime,
} from "@/lib/schedule";

const MINUTE_MS = 60_000;
const MAX_ATTEMPTS = 3; // first try + 2 retries after a serialization failure

export type ShowtimeResult =
  | { success: true; showtimeId?: string }
  | { success: false; error: string; status: number };

interface NewShowtime {
  movieId: string;
  screenId: string;
  startsAt: Date;
}

function isSerializationFailure(error: unknown): boolean {
  // P2034 = "Transaction failed due to a write conflict or a deadlock. Please retry"
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

/**
 * Create a showtime if the screen is free (incl. cleaning buffer).
 * Serializable: two admins inserting overlapping shows at once is write skew,
 * which RepeatableRead cannot detect. Serialization failures are retried.
 */
export async function createShowtime(input: NewShowtime): Promise<ShowtimeResult> {
  if (Number.isNaN(input.startsAt.getTime())) {
    return { success: false, error: "Invalid start time.", status: 400 };
  }
  if (input.startsAt.getTime() < Date.now()) {
    return { success: false, error: "Showtimes must start in the future.", status: 400 };
  }

  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction((tx) => insertIfScreenFree(tx, input), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializationFailure(error)) throw error;
      if (attempt >= MAX_ATTEMPTS) {
        return {
          success: false,
          status: 409,
          error: "The schedule is busy right now. Refresh and try again.",
        };
      }
      // Retry from scratch: if the other admin really took the slot, the retry sees it and returns "Clashes with …"
    }
  }
}

async function insertIfScreenFree(
  tx: Prisma.TransactionClient,
  input: NewShowtime
): Promise<ShowtimeResult> {
  const movie = await tx.movie.findUnique({
    where: { id: input.movieId },
    select: { duration: true, isActive: true },
  });
  if (!movie) return { success: false, error: "Movie not found.", status: 404 };
  if (!movie.isActive) {
    return { success: false, error: "This movie is hidden. Activate it first.", status: 409 };
  }

  const screen = await tx.screen.findUnique({ where: { id: input.screenId }, select: { id: true } });
  if (!screen) return { success: false, error: "Screen not found.", status: 404 };

  const endsAt = computeEndsAt(input.startsAt, movie.duration);
  const buffer = CLEANING_BUFFER_MINUTES * MINUTE_MS;

  // Clash when existing.start < new.end + buffer AND existing.end + buffer > new.start
  const clash = await tx.showtime.findFirst({
    where: {
      screenId: input.screenId,
      startsAt: { lt: new Date(endsAt.getTime() + buffer) },
      endsAt: { gt: new Date(input.startsAt.getTime() - buffer) },
    },
    include: { movie: { select: { title: true } } },
  });
  if (clash) {
    return {
      success: false,
      status: 409,
      error: `Clashes with ${clash.movie.title} (${formatCinemaTime(clash.startsAt)}–${formatCinemaTime(
        clash.endsAt
      )}) on this screen, including the ${CLEANING_BUFFER_MINUTES}-minute cleaning buffer.`,
    };
  }

  const showtime = await tx.showtime.create({
    data: { movieId: input.movieId, screenId: input.screenId, startsAt: input.startsAt, endsAt },
  });
  return { success: true, showtimeId: showtime.id };
}

/** All showtimes starting on one Bangkok calendar day, e.g. "2026-11-05". */
export async function listShowtimesForDay(day: string) {
  const start = new Date(`${day}T00:00:00${CINEMA_UTC_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * MINUTE_MS);

  const rows = await prisma.showtime.findMany({
    where: { startsAt: { gte: start, lt: end } },
    orderBy: [{ screen: { number: "asc" } }, { startsAt: "asc" }],
    include: {
      movie: { select: { title: true } },
      screen: { select: { id: true, name: true, format: true } },
      _count: {
        select: {
          seats: { where: { booking: { status: "PAID" } } }, // seats actually sold
          bookings: true, // any booking, even pending
        },
      },
    },
  });

  return rows.map((s) => ({
    id: s.id,
    movieTitle: s.movie.title,
    screenId: s.screen.id,
    screenName: s.screen.name,
    screenFormat: s.screen.format,
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    seatsSold: s._count.seats,
    hasBookings: s._count.bookings > 0,
  }));
}

export type AdminShowtimeRow = Awaited<ReturnType<typeof listShowtimesForDay>>[number];

export async function getShowtimeFormOptions() {
  const [movies, screens] = await Promise.all([
    prisma.movie.findMany({
      where: { isActive: true },
      orderBy: { title: "asc" },
      select: { id: true, title: true, duration: true },
    }),
    prisma.screen.findMany({
      orderBy: { number: "asc" },
      select: { id: true, name: true, format: true },
    }),
  ]);
  return { movies, screens };
}

/** Only empty showtimes can be deleted; moving a sold show would change what customers paid for. */
export async function deleteShowtime(id: string): Promise<ShowtimeResult> {
  const showtime = await prisma.showtime.findUnique({
    where: { id },
    select: { _count: { select: { bookings: true } } },
  });
  if (!showtime) return { success: false, error: "Showtime not found.", status: 404 };
  if (showtime._count.bookings > 0) {
    return { success: false, error: "This showtime has bookings and cannot be deleted.", status: 409 };
  }

  try {
    await prisma.showtime.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2003: a booking appeared between our check and the delete (foreign key is the safety net)
      if (error.code === "P2003") {
        return { success: false, error: "This showtime has bookings and cannot be deleted.", status: 409 };
      }
      if (error.code === "P2025") return { success: false, error: "Showtime not found.", status: 404 };
    }
    throw error;
  }
}
