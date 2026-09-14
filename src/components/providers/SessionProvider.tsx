// src/components/providers/SessionProvider.tsx
// Client-side wrapper for NextAuth SessionProvider
// Required because layout.tsx is a Server Component

"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
