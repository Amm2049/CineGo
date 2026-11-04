// src/lib/admin-guard.ts
// Shared role checks for /api/admin/* route handlers and admin pages.
// proxy.ts only protects /admin pages, so every admin API must check for itself.

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

type RoleCheck =
  | { ok: true; userId: string; role: string }
  | { ok: false; response: NextResponse };

async function requireRole(allowed: readonly string[]): Promise<RoleCheck> {
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
      response: NextResponse.json(
        { error: "You do not have access to this action" },
        { status: 403 }
      ),
    };
  }

  return { ok: true, userId: session.user.id, role: session.user.role };
}

/** Catalog, schedule and dashboard: ADMIN only. */
export function requireAdmin() {
  return requireRole(["ADMIN"]);
}

/** Server-component version for admin-only pages: redirects instead of returning JSON. */
export async function requireAdminPage(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/admin/scanner");
}
