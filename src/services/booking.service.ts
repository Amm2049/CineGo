// src/services/booking.service.ts
// CineGo — Atomic simulated payment: validates the user's seat hold, re-prices it server-side,
// marks the booking PAID, records the Payment, and issues the digital Ticket in one transaction.
// Used when PAYMENT_PROVIDER is not "stripe" (CI, concurrency test, offline demos). The Stripe
// PromptPay path lives in payment.service.ts and reaches PAID only via settleSucceededPayment().

import { randomUUID } from "crypto";
import { MOVIE_NOT_ON_SALE } from "@/lib/movie-sales";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createTicketsForBooking } from "@/services/ticket.service";
import { invalidateUserRecommendations } from "@/services/recommendation.service";

export type ConfirmPaymentResult =
  | { success: true; bookingId: string; amount: number }
  | { success: false; error: string; status: number };

/**
 * Pay for the seats the user currently holds for a showtime (simulated payment).
 *
 * Guarantees (FR-06):
 * - Only seats still held by this user's PENDING booking (heldUntil > NOW) can be paid for.
 * - The total is recomputed from Seat prices in the database, never taken from the client.
 * - Booking → PAID, Payment, and Ticket are written atomically; a concurrent change to the
 *   same seats aborts the transaction (RepeatableRead) and @@unique([showtimeId, seatId])
 *   still blocks any second booking of a seat.
 */
export async function confirmBookingPayment(params: {
  userId: string;
  showtimeId: string;
}): Promise<ConfirmPaymentResult> {
  const { userId, showtimeId } = params;
  const now = new Date();

  try {
    const result = await prisma.$transaction(
      async (tx): Promise<ConfirmPaymentResult> => {
        const booking = await tx.booking.findFirst({
          where: { showtimeId, userId, status: "PENDING" },
          include: {
            showtime: { select: { startsAt: true, movie: { select: { isActive: true } } } },
            seats: { include: { seat: true } },
            payment: { select: { id: true } },
          },
        });

        if (!booking || booking.seats.length === 0) {
          return { success: false, error: "You have no held seats to pay for.", status: 409 };
        }

        if (booking.payment) {
          // A PromptPay payment is already open for this booking (Payment.bookingId is unique)
          return {
            success: false,
            error: "A payment is already in progress for these seats.",
            status: 409,
          };
        }

        if (booking.showtime.startsAt <= now) {
          return { success: false, error: "This showtime has already started.", status: 409 };
        }

        if (!booking.showtime.movie.isActive) {
          return { success: false, error: MOVIE_NOT_ON_SALE, status: 409 };
        }

        const hasExpiredHold = booking.seats.some(
          (bs) => !bs.heldUntil || new Date(bs.heldUntil) <= now
        );
        if (hasExpiredHold) {
          return {
            success: false,
            error: "Your seat hold has expired. Please select your seats again.",
            status: 409,
          };
        }

        // Server-side price revalidation from the Seat table
        const amount = booking.seats.reduce((sum, bs) => sum + Number(bs.seat.price), 0);

        for (const bs of booking.seats) {
          await tx.bookingSeat.update({
            where: { id: bs.id },
            data: { priceAtPurchase: bs.seat.price, heldUntil: null },
          });
        }

        await tx.booking.update({
          where: { id: booking.id },
          data: { status: "PAID", totalAmount: amount },
        });

        await tx.payment.create({
          data: {
            bookingId: booking.id,
            provider: "SIMULATED",
            status: "SUCCESS",
            amount,
            transactionReference: `SIM-${randomUUID()}`,
            paidAt: now,
          },
        });

        await createTicketsForBooking(tx, booking.id); // one ticket (QR) per seat

        return { success: true, bookingId: booking.id, amount };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
    );

    if (result.success) {
      // Booking history feeds the AI recommendations, so refresh them on next visit
      await invalidateUserRecommendations(userId);
    }

    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: unique constraint (double-booking), P2034: serialization conflict
      if (error.code === "P2002" || error.code === "P2034") {
        return {
          success: false,
          error: "One of your seats was just taken by another customer. Please choose again.",
          status: 409,
        };
      }
    }
    console.error("[BookingService] confirmBookingPayment error:", error);
    return { success: false, error: "Payment could not be processed.", status: 500 };
  }
}
