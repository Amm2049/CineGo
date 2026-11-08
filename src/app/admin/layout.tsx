// src/app/admin/layout.tsx
// Server-side role check for every /admin page (defence in depth behind proxy.ts)

import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/"); // STAFF: scanner only (see requireAdminPage)

  return (
    // w-full min-w-0: as a flex item of <body>, this would otherwise grow to its widest table and
    // make the whole page scroll sideways on phones; tables scroll inside their own overflow-x-auto box
    <div className="w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AdminNav role={role} />
      <div className="mt-8">{children}</div>
    </div>
  );
}
