// src/middleware.ts
// Route protection: restricts /admin/* to ADMIN role only
// Unauthenticated users are redirected to /login with callbackUrl

import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = req.nextUrl;

  // Protect all /admin/* routes
  if (pathname.startsWith("/admin")) {
    if (!token) {
      // Not logged in -- redirect to login
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (token.role !== "ADMIN") {
      // Logged in but not admin -- redirect to homepage
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // Protect /profile, /tickets, /checkout (must be logged in)
  if (
    pathname.startsWith("/profile") ||
    pathname.startsWith("/tickets") ||
    pathname.startsWith("/checkout")
  ) {
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/profile/:path*", "/tickets/:path*", "/checkout/:path*"],
};
