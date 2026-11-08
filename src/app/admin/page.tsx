// src/app/admin/page.tsx — admin dashboard
import Link from "next/link";
import { getDashboardStats } from "@/services/admin.service";
import { formatCinemaDateTime } from "@/lib/schedule";
import { requireAdminPage } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminPage(); // revenue is not for door staff
  const stats = await getDashboardStats();

  const { today } = stats;
  const dayLabel = new Date(`${stats.day}T12:00:00+07:00`).toLocaleDateString("en-GB", {
    timeZone: "Asia/Bangkok",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Today first: what an admin acts on. All-time totals follow as context.
  const todayCards = [
    { label: "Revenue today", value: `฿${today.revenue.toLocaleString("en-US")}` },
    { label: "Bookings today", value: String(today.bookings), hint: `${today.seatsSold} seats` },
    { label: "Shows today", value: String(today.shows), href: `/admin/showtimes?date=${stats.day}` },
    {
      label: "Admitted today",
      value: `${today.admitted} / ${today.ticketsForTodaysShows}`,
      hint: "tickets for today's shows",
      href: "/admin/scanner",
    },
  ];
  const allTime = [
    { label: "Active movies", value: String(stats.activeMovies), href: "/admin/movies" },
    { label: "Upcoming showtimes", value: String(stats.upcomingShowtimes), href: "/admin/showtimes" },
    { label: "Total revenue", value: `฿${stats.totalRevenue.toLocaleString("en-US")}` },
    { label: "Tickets scanned", value: `${stats.ticketsUsed} / ${stats.ticketsSold}` },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">Today · {dayLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {todayCards.map((card) => {
          const body = (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{card.label}</p>
              <p className="mt-2 text-3xl font-black text-white">{card.value}</p>
              {card.hint && <p className="mt-1 text-xs text-zinc-500">{card.hint}</p>}
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
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold text-white">Up next</h2>
          <Link href="/admin/showtimes" className="text-sm font-semibold text-[#c7d2fe] hover:text-white">
            Full schedule →
          </Link>
        </div>
        {stats.upNext.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">No upcoming shows. Add one in Showtimes.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/5">
            {stats.upNext.map((s) => {
              const pct = s.capacity > 0 ? Math.round((s.seatsSold / s.capacity) * 100) : 0;
              return (
                <li key={s.id} className="py-2.5 text-sm sm:flex sm:items-center sm:gap-4">
                  {/* Phones: two lines (time + title, then theatre + sold); desktop: one row */}
                  <div className="flex min-w-0 flex-1 items-baseline gap-3">
                    <span className="shrink-0 font-mono text-zinc-200">{formatCinemaDateTime(s.startsAt)}</span>
                    <span className="min-w-0 truncate font-semibold text-white">{s.movieTitle}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 sm:mt-0">
                    <span className="flex-1 truncate text-zinc-400 sm:flex-none">
                      {s.screenName} · {s.screenFormat}
                    </span>
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10 sm:w-24" aria-hidden>
                      <span className="block h-full rounded-full bg-[#5938ff]" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-14 whitespace-nowrap text-right text-xs text-zinc-300">
                      {s.seatsSold} / {s.capacity}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

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

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">All time</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {allTime.map((item) => {
            const body = (
              <>
                <p className="text-xs text-zinc-400">{item.label}</p>
                <p className="mt-0.5 text-lg font-bold text-white">{item.value}</p>
              </>
            );
            const cls = "block rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3";
            return item.href ? (
              <Link key={item.label} href={item.href} className={`${cls} hover:border-[#5938ff]/50`}>
                {body}
              </Link>
            ) : (
              <div key={item.label} className={cls}>
                {body}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
