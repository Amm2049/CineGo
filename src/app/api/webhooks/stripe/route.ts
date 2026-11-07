// src/app/api/webhooks/stripe/route.ts
// Stripe webhook (Phase 9). The signature is verified against the raw body with
// STRIPE_WEBHOOK_SECRET before anything is trusted. Errors return 500 so Stripe retries;
// every handler is idempotent, so retries and duplicate deliveries are safe.

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { handleStripeEvent } from "@/services/payment.service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[Stripe webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe-Signature header" }, { status: 400 });
  }

  const rawBody = await request.text(); // must be the exact bytes Stripe signed

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    console.warn("[Stripe webhook] signature verification failed:", (error as Error).message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[Stripe webhook] ${event.type} ${event.id} failed:`, error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
