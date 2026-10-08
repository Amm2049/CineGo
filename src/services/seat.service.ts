// src/services/seat.service.ts
// CineGo — Domain service for Seat availability, 5-minute atomic holds, and layout mapping

import prisma from "@/lib/prisma";
import { SeatLayoutItem, SeatTier, ShowtimeSeatMapResponse } from "@/types";

export const HOLD_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Determine pricing tier from row label:
 * Rows A–B: VIP (฿280)
 * Rows C–D: Premium (฿200)
 * Rows E–F: Standard (฿150)
 */
export function getRowTier(rowLabel: string): SeatTier {
  const upper = rowLabel.toUpperCase();
  if (upper === "A" || upper === "B") return "VIP";
  if (upper === "C" || upper === "D") return "PREMIUM";
  return "STANDARD";
}

/**
 * Fetch seat layout and real-time availability for a given showtime.
 * Dynamically resolves seat status:
 * - BOOKED: Seat has a BookingSeat record in a PAID booking.
 * - HELD: Seat has heldUntil > NOW in a PENDING booking.
 * - AVAILABLE: No record, or heldUntil <= NOW, or cancelled booking.
 */
export async function getShowtimeSeatMap(
  showtimeId: string,
  currentUserId?: string
): Promise<ShowtimeSeatMapResponse | null> {
  const now = new Date();

  // 1. Fetch showtime with screen, cinema, movie, and screen seats
  const showtime = await prisma.showtime.findUnique({
    where: { id: showtimeId },
    include: {
      movie: {
        include: {
          genres: { include: { genre: true } },
        },
      },
      screen: {
        include: {
          cinema: true,
          seats: {
            orderBy: [{ rowLabel: "asc" }, { seatNum: "asc" }],
          },
        },
      },
      seats: {
        include: {
          booking: {
            select: { id: true, userId: true, status: true },
          },
        },
      },
    },
  });

  if (!showtime) return null;

  // 2. Map existing active bookings/holds by seatId
  // Map: seatId -> { isBooked: boolean, isHeld: boolean, heldUntil: Date | null, isHeldByMe: boolean }
  const seatStatusMap = new Map<
    string,
    { isBooked: boolean; isHeld: boolean; heldUntil: Date | null; isHeldByMe: boolean }
  >();

  for (const bs of showtime.seats) {
    const isPaid = bs.booking.status === "PAID";
    const isHeld =
      bs.booking.status === "PENDING" &&
      bs.heldUntil !== null &&
      new Date(bs.heldUntil) > now;

    if (isPaid) {
      seatStatusMap.set(bs.seatId, {
        isBooked: true,
        isHeld: false,
        heldUntil: null,
        isHeldByMe: bs.booking.userId === currentUserId,
      });
    } else if (isHeld) {
      seatStatusMap.set(bs.seatId, {
        isBooked: false,
        isHeld: true,
        heldUntil: bs.heldUntil,
        isHeldByMe: bs.booking.userId === currentUserId,
      });
    }
  }

  // 3. Assemble seat grid items
  let availableCount = 0;
  const seatItems: SeatLayoutItem[] = showtime.screen.seats.map((seat) => {
    const statusInfo = seatStatusMap.get(seat.id);
    let status: "AVAILABLE" | "HELD" | "BOOKED" = "AVAILABLE";
    let isHeldByMe = false;
    let heldUntilStr: string | null = null;

    if (statusInfo?.isBooked) {
      status = "BOOKED";
    } else if (statusInfo?.isHeld) {
      status = "HELD";
      isHeldByMe = statusInfo.isHeldByMe;
      heldUntilStr = statusInfo.heldUntil ? statusInfo.heldUntil.toISOString() : null;
    } else {
      status = "AVAILABLE";
      availableCount++;
    }

    return {
      id: seat.id,
      rowLabel: seat.rowLabel,
      seatNum: seat.seatNum,
      price: Number(seat.price),
      tier: getRowTier(seat.rowLabel),
      status,
      heldUntil: heldUntilStr,
      isHeldByMe,
    };
  });

  return {
    showtime: {
      id: showtime.id,
      startsAt: showtime.startsAt.toISOString(),
      endsAt: showtime.endsAt.toISOString(),
      movie: {
        id: showtime.movie.id,
        title: showtime.movie.title,
        posterUrl: showtime.movie.posterUrl,
        duration: showtime.movie.duration,
        genres: showtime.movie.genres.map((g) => g.genre.name),
      },
      screen: {
        id: showtime.screen.id,
        name: showtime.screen.name,
        cinemaName: showtime.screen.cinema.name,
      },
    },
    seats: seatItems,
    pricing: {
      standard: 150,
      premium: 200,
      vip: 280,
    },
    totalSeats: seatItems.length,
    availableSeats: availableCount,
  };
}

/**
 * Temporarily hold selected seats for 5 minutes during checkout.
 * Uses atomic transaction to guarantee no two users can hold the same seat simultaneously.
 */
export async function holdShowtimeSeats(params: {
  showtimeId: string;
  seatIds: string[];
  userId: string;
}): Promise<{
  success: boolean;
  bookingId?: string;
  heldUntil?: Date;
  error?: string;
}> {
  const { showtimeId, seatIds, userId } = params;
  if (!seatIds.length) {
    return { success: false, error: "No seats selected" };
  }

  const now = new Date();
  const heldUntil = new Date(Date.now() + HOLD_DURATION_MS);

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch requested seats to calculate total
      const seats = await tx.seat.findMany({
        where: { id: { in: seatIds } },
      });

      if (seats.length !== seatIds.length) {
        return { success: false, error: "One or more invalid seats selected" };
      }

      const totalAmount = seats.reduce((sum, s) => sum + Number(s.price), 0);

      // 2. Check for conflicting active bookings or holds
      const existingBookings = await tx.bookingSeat.findMany({
        where: {
          showtimeId,
          seatId: { in: seatIds },
        },
        include: {
          booking: {
            select: { id: true, userId: true, status: true },
          },
        },
      });

      for (const bs of existingBookings) {
        // Seat already purchased
        if (bs.booking.status === "PAID") {
          return {
            success: false,
            error: "Seat is already booked by another customer.",
          };
        }

        // Seat held by another user
        if (
          bs.booking.status === "PENDING" &&
          bs.booking.userId !== userId &&
          bs.heldUntil &&
          new Date(bs.heldUntil) > now
        ) {
          return {
            success: false,
            error: "Seat is temporarily held by another customer. Please choose different seats.",
          };
        }
      }

      // 3. Find or create user's PENDING booking for this showtime
      let booking = await tx.booking.findFirst({
        where: {
          showtimeId,
          userId,
          status: "PENDING",
        },
      });

      if (booking) {
        // Update total
        booking = await tx.booking.update({
          where: { id: booking.id },
          data: { totalAmount },
        });

        // Clean up previous held seats for this booking that are no longer selected
        await tx.bookingSeat.deleteMany({
          where: {
            bookingId: booking.id,
            seatId: { notIn: seatIds },
          },
        });
      } else {
        booking = await tx.booking.create({
          data: {
            userId,
            showtimeId,
            status: "PENDING",
            totalAmount,
          },
        });
      }

      // 4. Upsert BookingSeat records with heldUntil
      for (const seat of seats) {
        await tx.bookingSeat.upsert({
          where: {
            showtimeId_seatId: {
              showtimeId,
              seatId: seat.id,
            },
          },
          update: {
            bookingId: booking.id,
            priceAtPurchase: seat.price,
            heldUntil,
          },
          create: {
            bookingId: booking.id,
            showtimeId,
            seatId: seat.id,
            priceAtPurchase: seat.price,
            heldUntil,
          },
        });
      }

      return {
        success: true,
        bookingId: booking.id,
        heldUntil,
      };
    });
  } catch (error) {
    console.error("[SeatService] holdShowtimeSeats error:", error);
    return {
      success: false,
      error: "Failed to reserve seats due to a concurrency conflict. Please try again.",
    };
  }
}

/**
 * Release held seats when deselected by customer or abandoned.
 */
export async function releaseShowtimeSeats(params: {
  showtimeId: string;
  userId: string;
  seatIds?: string[];
}): Promise<{ success: boolean }> {
  const { showtimeId, userId, seatIds } = params;

  try {
    const booking = await prisma.booking.findFirst({
      where: {
        showtimeId,
        userId,
        status: "PENDING",
      },
    });

    if (!booking) return { success: true };

    if (seatIds && seatIds.length > 0) {
      await prisma.bookingSeat.deleteMany({
        where: {
          bookingId: booking.id,
          seatId: { in: seatIds },
        },
      });
    } else {
      // Release all seats for this pending booking
      await prisma.bookingSeat.deleteMany({
        where: { bookingId: booking.id },
      });
    }

    return { success: true };
  } catch (error) {
    console.error("[SeatService] releaseShowtimeSeats error:", error);
    return { success: false };
  }
}

/**
 * Single-seat hold convenience helper (matching CiniGo_Phase_Plan.md specification)
 */
export async function holdSeat(showtimeId: string, seatId: string, bookingId: string) {
  const heldUntil = new Date(Date.now() + HOLD_DURATION_MS);
  const seat = await prisma.seat.findUnique({ where: { id: seatId } });
  if (!seat) throw new Error("Seat not found");

  return prisma.bookingSeat.upsert({
    where: {
      showtimeId_seatId: {
        showtimeId,
        seatId,
      },
    },
    update: {
      bookingId,
      priceAtPurchase: seat.price,
      heldUntil,
    },
    create: {
      bookingId,
      showtimeId,
      seatId,
      priceAtPurchase: seat.price,
      heldUntil,
    },
  });
}

/**
 * Single-seat release convenience helper (matching CiniGo_Phase_Plan.md specification)
 */
export async function releaseSeat(showtimeId: string, seatId: string) {
  return prisma.bookingSeat.deleteMany({
    where: {
      showtimeId,
      seatId,
    },
  });
}
