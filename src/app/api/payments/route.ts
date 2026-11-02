// src/app/api/payments/route.ts
// Simulated payment: atomically confirms the user's held seats and issues a digital ticket

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { confirmBookingPayment } from "@/services/booking.service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required to complete payment" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const showtimeId = typeof body?.showtimeId === "string" ? body.showtimeId : "";

    if (!showtimeId) {
      return NextResponse.json({ error: "showtimeId is required" }, { status: 400 });
    }

    const result = await confirmBookingPayment({
      userId: session.user.id,
      showtimeId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId,
      ticketId: result.ticketId,
      amount: result.amount,
    });
  } catch (error) {
    console.error("[POST /api/payments] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
