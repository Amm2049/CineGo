// src/proxy.ts
// Route protection (Next.js 16 Proxy, formerly Middleware): /admin/* is ADMIN only, except
// /admin/scanner which STAFF may also use. /profile and /tickets are CUSTOMER only.
// APIs are NOT matched: each API checks the role itself (admin-guard.ts).
// Unauthenticated users are redirected to /login with callbackUrl

import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { homePathForRole, isCustomer } from "@/lib/roles";

export async function proxy(req: NextRequest) {
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

    // STAFF may use the ticket scanner; everything else under /admin is ADMIN only
    const isScanner = pathname === "/admin/scanner" || pathname.startsWith("/admin/scanner/");
    const allowed = token.role === "ADMIN" || (token.role === "STAFF" && isScanner);
    if (!allowed) {
      const target = token.role === "STAFF" ? "/admin/scanner" : "/";
      return NextResponse.redirect(new URL(target, req.url));
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

    // Tickets and the customer profile are for customer accounts. /checkout is left to the page,
    // which explains why admin/staff can't book instead of silently redirecting.
    if (!isCustomer(token.role as string) && !pathname.startsWith("/checkout")) {
      return NextResponse.redirect(new URL(homePathForRole(token.role as string), req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/profile/:path*", "/tickets/:path*", "/checkout/:path*"],
};
