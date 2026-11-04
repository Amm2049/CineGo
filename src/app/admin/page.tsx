// src/app/admin/page.tsx — admin dashboard
import Link from "next/link";
import { getDashboardStats } from "@/services/admin.service";
import { formatCinemaDateTime } from "@/lib/schedule";
import { requireAdminPage } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminPage(); // revenue is not for door staff
  const stats = await getDashboardStats();

  const cards = [
    { label: "Active movies", value: String(stats.activeMovies), href: "/admin/movies" },
    { label: "Upcoming showtimes", value: String(stats.upcomingShowtimes), href: "/admin/showtimes" },
    { label: "Revenue", value: `฿${stats.totalRevenue.toLocaleString("en-US")}` },
    { label: "Tickets scanned", value: `${stats.ticketsUsed} / ${stats.ticketsSold}`, href: "/admin/scanner" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-black text-white">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const body = (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{card.label}</p>
              <p className="mt-2 text-3xl font-black text-white">{card.value}</p>
            </>
          );
          const cls = "block rounded-2xl border border-white/10 bg-white/[0.03] p-5";
          return card.href ? (
            <Link key={card.label} href={card.href} className={`${cls} hover:border-[#5938ff]/70`}>
              {body}
            </Link>
          ) : (
            <div key={card.label} className={cls}>
              {body}
            </div>
          );
        })}
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-bold text-white">Recent payments</h2>
        {stats.recentPayments.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">No payments yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="py-2">When</th>
                  <th className="py-2">Customer</th>
                  <th className="py-2">Movie</th>
                  <th className="py-2">Seats</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-200">
                {stats.recentPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2">{formatCinemaDateTime(p.paidAt)}</td>
                    <td className="py-2">{p.email}</td>
                    <td className="py-2">{p.movieTitle}</td>
                    <td className="py-2">{p.seats}</td>
                    <td className="py-2 text-right">฿{p.amount.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
