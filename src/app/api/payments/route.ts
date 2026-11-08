// src/app/api/payments/route.ts
// Start payment for the user's held seats.
// PAYMENT_PROVIDER=stripe → creates a PromptPay PaymentIntent and returns its QR (Phase 9).
// Otherwise           → simulated payment: confirms at once and issues the digital ticket (Phase 7).

import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/admin-guard";
import { getPaymentProvider } from "@/lib/payment-config";
import { StripeNotConfiguredError } from "@/lib/stripe";
import { confirmBookingPayment } from "@/services/booking.service";
import { startStripePayment } from "@/services/payment.service";
import type { StartPaymentResponse } from "@/types";

export async function POST(request: NextRequest) {
  try {
    // Booking is for customer accounts: admin/staff get 403, guests 401
    const auth = await requireCustomer();
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const showtimeId = typeof body?.showtimeId === "string" ? body.showtimeId : "";

    if (!showtimeId) {
      return NextResponse.json({ error: "showtimeId is required" }, { status: 400 });
    }

    if (getPaymentProvider() === "stripe") {
      const started = await startStripePayment({ userId: auth.userId, showtimeId });
      if (!started.success) {
        return NextResponse.json({ error: started.error }, { status: started.status });
      }
      const response: StartPaymentResponse = {
        provider: "stripe",
        success: true,
        checkout: started.checkout,
      };
      return NextResponse.json(response);
    }

    const result = await confirmBookingPayment({
      userId: auth.userId,
      showtimeId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const response: StartPaymentResponse = {
      provider: "simulated",
      success: true,
      bookingId: result.bookingId,
      ticketId: result.ticketId,
      amount: result.amount,
    };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      console.error("[POST /api/payments] Stripe is not configured:", error.message);
      return NextResponse.json(
        { error: "Online payment is not available right now." },
        { status: 503 }
      );
    }
    console.error("[POST /api/payments] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
