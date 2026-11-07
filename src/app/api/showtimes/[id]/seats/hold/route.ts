// src/app/api/showtimes/[id]/seats/hold/route.ts
// Atomically hold seats for 5 minutes during checkout

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { holdShowtimeSeats } from "@/services/seat.service";
import { closeExpiredPaymentsForSeats } from "@/services/payment.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required to hold seats" },
        { status: 401 }
      );
    }

    const { id: showtimeId } = await params;
    const body = await request.json();
    const seatIds = Array.isArray(body?.seatIds) ? body.seatIds : [];

    if (!seatIds.length) {
      return NextResponse.json(
        { error: "Please select at least one seat" },
        { status: 400 }
      );
    }

    // Phase 9: close PromptPay payments whose window is over before their seats can be taken.
    // Runs for every provider (one query when there are none) so switching back to the
    // simulated payment never leaves seats locked behind an old Stripe payment.
    await closeExpiredPaymentsForSeats({ showtimeId, seatIds, userId: session.user.id });

    const result = await holdShowtimeSeats({
      showtimeId,
      seatIds,
      userId: session.user.id,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId,
      heldUntil: result.heldUntil?.toISOString(),
      heldSeatIds: seatIds,
    });
  } catch (error) {
    console.error("[POST /api/showtimes/[id]/seats/hold] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
