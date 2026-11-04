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
  if (role !== "ADMIN") redirect("/");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AdminNav role={role} />
      <div className="mt-8">{children}</div>
    </div>
  );
}
