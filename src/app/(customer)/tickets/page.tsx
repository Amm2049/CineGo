// src/app/(customer)/tickets/page.tsx
// My Tickets — booking history with upcoming and past ticket passes

import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listUserTicketPasses } from "@/services/ticket.service";
import { TicketPass } from "@/types";

export const dynamic = "force-dynamic";

function TicketRow({ ticket, isPast }: { ticket: TicketPass; isPast: boolean }) {
  const startsAt = new Date(ticket.showtime.startsAt);
  const statusLabel = ticket.status === "USED" ? "Used" : isPast ? "Ended" : "Upcoming";

  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all hover:border-[#5938ff]/70 focus-visible:outline-2 focus-visible:outline-[#5938ff] ${
        isPast ? "border-white/10 bg-white/[0.02]" : "border-[#2500f0]/40 bg-[#06071d]"
      }`}
    >
      {/* Date block — the first thing people scan for in a ticket list */}
      <div
        className={`w-14 shrink-0 py-2 rounded-xl text-center ${
          isPast ? "bg-white/5 text-zinc-400" : "bg-[#2500f0]/25 text-white"
        }`}
      >
        <div className="text-[11px] uppercase font-bold tracking-wider">
          {startsAt.toLocaleDateString("en-US", { month: "short" })}
        </div>
        <div className="text-2xl font-black leading-none mt-0.5">{startsAt.getDate()}</div>
      </div>
      <div className="relative w-10 h-15 shrink-0 rounded-md overflow-hidden border border-white/20 hidden sm:block">
        <Image src={ticket.movie.posterUrl} alt="" fill sizes="40px" className="object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className={`font-bold truncate ${isPast ? "text-zinc-300" : "text-white"}`}>
          {ticket.movie.title}
        </h3>
        <p className="text-sm text-zinc-300 mt-0.5">
          {startsAt.toLocaleDateString("en-US", { weekday: "short" })} ·{" "}
          {startsAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} ·{" "}
          {ticket.showtime.screenName} · {ticket.showtime.screenFormat}
        </p>
        <p className="text-sm text-zinc-400 mt-0.5 truncate">
          Seat{ticket.seats.length > 1 ? "s" : ""} {ticket.seats.map((s) => s.label).join(", ")}
          <span className="font-mono"> · {ticket.bookingReference}</span>
        </p>
      </div>
      {/* Upcoming is already the section heading, so only flag Used / Ended */}
      {statusLabel !== "Upcoming" ? (
        <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-800 text-zinc-300">
          {statusLabel}
        </span>
      ) : (
        <span className="shrink-0 text-xl text-zinc-500" aria-hidden>
          ›
        </span>
      )}
    </Link>
  );
}

export default async function MyTicketsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/tickets");
  }

  const { upcoming, past } = await listUserTicketPasses(session.user.id);
  const hasTickets = upcoming.length + past.length > 0;

  return (
    <main className="min-h-screen bg-[#02020a] text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-10">
        <h1 className="text-3xl font-black uppercase tracking-tight">My Tickets</h1>

        {!hasTickets ? (
          <div className="p-10 rounded-2xl border border-white/10 text-center space-y-4">
            <p className="text-sm text-zinc-400">You haven&apos;t booked any tickets yet.</p>
            <Link
              href="/movies"
              className="inline-block px-6 py-3 rounded-xl bg-[#2500f0] hover:bg-[#3411ff] text-xs font-bold uppercase tracking-wider transition-all"
            >
              Browse Movies
            </Link>
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-[#c7d2fe]">
                Upcoming ({upcoming.length})
              </h2>
              {upcoming.length === 0 ? (
                <p className="text-sm text-zinc-500">No upcoming showtimes.</p>
              ) : (
                upcoming.map((t) => <TicketRow key={t.id} ticket={t} isPast={false} />)
              )}
            </section>

            {past.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-zinc-400">
                  Past ({past.length})
                </h2>
                {past.map((t) => (
                  <TicketRow key={t.id} ticket={t} isPast />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
