// src/lib/google-sign-in.ts
// What a "Continue with Google" sign-in may do. Pure functions: the database work is in src/lib/auth.ts.
//
// Rules:
// - Google sign-in is for CUSTOMER accounts only. Admin and staff keep signing in with their password,
//   so a Google account can never open the admin area.
// - Google must say the email address is verified; the email is how we match an existing account.
// - An existing customer with the same email (registered with a password) is logged into that account.
// - Otherwise a new CUSTOMER account is created without a password.

export type GoogleSignInDecision =
  | { action: "create" }
  | { action: "login" }
  | { action: "refuse"; reason: GoogleSignInRefusal };

export type GoogleSignInRefusal = "EmailNotVerified" | "StaffUsePassword";

/** Query-string error codes the login page understands (`/login?error=...`). */
export const GOOGLE_SIGN_IN_ERRORS: Record<GoogleSignInRefusal, string> = {
  EmailNotVerified: "Your Google account's email address isn't verified, so we can't use it to sign in.",
  StaffUsePassword: "Admin and staff accounts sign in with their email and password, not Google.",
};

/** Error thrown by the password login for an account that was created with Google. */
export const USE_GOOGLE_ERROR = "USE_GOOGLE";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function decideGoogleSignIn(input: {
  email: string | null | undefined;
  emailVerified: boolean | null | undefined;
  existingRole: string | null;
}): GoogleSignInDecision {
  if (!input.email || input.emailVerified !== true) return { action: "refuse", reason: "EmailNotVerified" };
  if (input.existingRole === null) return { action: "create" };
  if (input.existingRole !== "CUSTOMER") return { action: "refuse", reason: "StaffUsePassword" };
  return { action: "login" };
}

/** True when both Google OAuth credentials are configured (the button and provider are hidden otherwise). */
export function isGoogleSignInConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim());
}
