// src/app/api/auth/[...nextauth]/route.ts
// NextAuth v4 catch-all route handler for App Router

import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }