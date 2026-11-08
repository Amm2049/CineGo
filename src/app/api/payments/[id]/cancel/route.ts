// src/app/api/payments/[id]/cancel/route.ts
// Customer cancels the PromptPay payment, or their countdown reached zero.
// Cancels the Stripe PaymentIntent (QR stops working) and releases the seats. If the customer
// paid at the last second, the payment is settled instead and the response says SUCCESS.

import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/admin-guard";
import { cancelPaymentForUser } from "@/services/payment.service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Booking is for customer accounts: admin/staff get 403, guests 401
    const auth = await requireCustomer();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const status = await cancelPaymentForUser(id, auth.userId);
    if (!status) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error("[POST /api/payments/[id]/cancel] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
