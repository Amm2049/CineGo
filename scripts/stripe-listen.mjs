// Forwards Stripe test-mode webhooks to the local dev server.
// Uses STRIPE_SECRET_KEY from .env so the CLI's own login (which may point at
// another Stripe account) is never used or changed.
import { spawn } from "node:child_process";

try {
  process.loadEnvFile(".env");
} catch {
  // fall back to variables already in the environment
}

const key = process.env.STRIPE_SECRET_KEY;
if (!key?.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY in .env must be a test key (sk_test_...).");
  process.exit(1);
}

const port = process.env.PORT ?? "3000";
const child = spawn(
  "stripe",
  [
    "listen",
    "--api-key",
    key,
    "--events",
    "payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled",
    "--forward-to",
    `localhost:${port}/api/webhooks/stripe`,
  ],
  { stdio: "inherit", shell: process.platform === "win32" },
);
child.on("exit", (code) => process.exit(code ?? 0));
