// src/lib/credentials-sign-in.ts
// Client-side email + password sign-in that confirms a session really exists.
//
// NextAuth v4 answers a CSRF-token mismatch with a redirect to /api/auth/signin?csrf=true and
// NO `error`, so `signIn()` looks successful even though no session cookie was set. This happens
// on a first visit when two /api/auth/session requests race (React runs effects twice in dev)
// and each sets a different CSRF cookie. By the second attempt the cookie has settled, so one
// retry is enough.

import { getSession, signIn } from "next-auth/react";

export type SignInOutcome = "ok" | "invalid" | "failed";

export async function signInWithCredentials(
  email: string,
  password: string
): Promise<{ outcome: SignInOutcome; role: string | null }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) return { outcome: "invalid", role: null };
    const session = await getSession();
    if (session) return { outcome: "ok", role: session.user?.role ?? null };
  }
  return { outcome: "failed", role: null };
}
