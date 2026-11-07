// src/lib/stripe.ts
// CineGo — Lazy Stripe client (Phase 9). Created on first use so builds and the simulated
// provider never need STRIPE_SECRET_KEY. Test-mode keys only: this project never moves real money.

import Stripe from "stripe";

let client: Stripe | null = null;

export class StripeNotConfiguredError extends Error {}

export function isTestModeKey(key: string): boolean {
  return key.startsWith("sk_test_") || key.startsWith("rk_test_");
}

export function getStripe(): Stripe {
  if (client) return client;

  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new StripeNotConfiguredError("STRIPE_SECRET_KEY is not set");
  }
  if (!isTestModeKey(key)) {
    throw new StripeNotConfiguredError(
      "STRIPE_SECRET_KEY must be a test-mode key (sk_test_… or rk_test_…)"
    );
  }

  client = new Stripe(key, { maxNetworkRetries: 2 });
  return client;
}
