// src/app/api/payments/[id]/route.ts
// Payment status for the checkout page's 3-second poll. Also syncs with Stripe, so a payment
// completes even if the webhook is late, and closes the payment once its 10-minute window is over.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPaymentStatusForUser } from "@/services/payment.service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const status = await getPaymentStatusForUser(id, session.user.id);
    if (!status) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error("[GET /api/payments/[id]] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
