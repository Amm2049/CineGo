// src/lib/admin-guard.ts
// Shared role checks for API route handlers (/api/admin/* and the customer booking APIs) and admin pages.
// proxy.ts only protects pages, so every API must check for itself.

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

type RoleCheck =
  | { ok: true; userId: string; role: string }
  | { ok: false; response: NextResponse };

async function requireRole(
  allowed: readonly string[],
  forbiddenMessage = "You do not have access to this action"
): Promise<RoleCheck> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  if (!allowed.includes(session.user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: forbiddenMessage }, { status: 403 }),
    };
  }

  return { ok: true, userId: session.user.id, role: session.user.role };
}

/** Catalog, schedule and dashboard: ADMIN only. */
export function requireAdmin() {
  return requireRole(["ADMIN"]);
}

/** Door scanning: ADMIN or STAFF. The only /api/admin route STAFF may call is verify-ticket. */
export function requireStaff() {
  return requireRole(["ADMIN", "STAFF"]);
}

/**
 * Booking, payments, tickets and genre interests: CUSTOMER only.
 * Admin and staff accounts run the cinema; they use a customer account to buy tickets.
 */
export function requireCustomer() {
  return requireRole(["CUSTOMER"], "This is for customer accounts. Sign in with a customer account to book tickets.");
}

/** Server-component version for admin-only pages: redirects instead of returning JSON. */
export async function requireAdminPage(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/admin/scanner");
}
