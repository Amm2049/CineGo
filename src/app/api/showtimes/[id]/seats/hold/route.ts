// src/app/api/showtimes/[id]/seats/hold/route.ts
// Atomically hold seats for 5 minutes during checkout

import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/admin-guard";
import { holdShowtimeSeats } from "@/services/seat.service";
import { closeExpiredPaymentsForSeats } from "@/services/payment.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Booking is for customer accounts: admin/staff get 403, guests 401
    const auth = await requireCustomer();
    if (!auth.ok) return auth.response;

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
    await closeExpiredPaymentsForSeats({ showtimeId, seatIds, userId: auth.userId });

    const result = await holdShowtimeSeats({
      showtimeId,
      seatIds,
      userId: auth.userId,
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
