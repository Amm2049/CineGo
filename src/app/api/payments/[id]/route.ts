// src/app/api/payments/[id]/route.ts
// Payment status for the checkout page's 3-second poll. Also syncs with Stripe, so a payment
// completes even if the webhook is late, and closes the payment once its 10-minute window is over.

import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/admin-guard";
import { getPaymentStatusForUser } from "@/services/payment.service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Booking is for customer accounts: admin/staff get 403, guests 401
    const auth = await requireCustomer();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const status = await getPaymentStatusForUser(id, auth.userId);
    if (!status) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error("[GET /api/payments/[id]] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
