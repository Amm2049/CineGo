// src/components/providers/SessionProvider.tsx
// Client-side wrapper for NextAuth SessionProvider
// Required because layout.tsx is a Server Component

"use client";

import type { Session } from "next-auth";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

// `session` comes from the server (root layout), so the first render already knows who is logged in.
// Without it, every reload drew the navbar logged-out first, then re-drew it once /api/auth/session answered.
export function SessionProvider({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  return <NextAuthSessionProvider session={session}>{children}</NextAuthSessionProvider>;
}
