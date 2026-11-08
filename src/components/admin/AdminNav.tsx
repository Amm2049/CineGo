"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Order = how often an admin needs it: overview → daily schedule → weekly catalog → door (mostly staff)
const LINKS = [
  { href: "/admin", label: "Dashboard", staff: false },
  { href: "/admin/showtimes", label: "Showtimes", staff: false },
  { href: "/admin/movies", label: "Movies", staff: false },
  { href: "/admin/scanner", label: "Ticket Scanner", staff: true },
];

export default function AdminNav({ role }: { role: string }) {
  const pathname = usePathname();
  const links = role === "ADMIN" ? LINKS : LINKS.filter((l) => l.staff);

  return (
    <nav className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
      {links.map((link) => {
        const active =
          link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              active ? "bg-[#2500f0] text-white" : "text-zinc-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
