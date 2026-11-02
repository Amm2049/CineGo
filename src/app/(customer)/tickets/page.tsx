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
  const statusLabel = ticket.status === "USED" ? "Used" : isPast ? "Expired" : "Active";

  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all hover:border-[#5938ff]/70 ${
        isPast ? "border-white/10 bg-white/[0.02] opacity-60" : "border-[#2500f0]/40 bg-[#06071d]"
      }`}
    >
      <div className="relative w-12 h-18 shrink-0 rounded-lg overflow-hidden border border-white/20">
        <Image src={ticket.movie.posterUrl} alt={ticket.movie.title} fill className="object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold truncate">{ticket.movie.title}</h3>
        <p className="text-xs text-zinc-400 mt-0.5">
          {startsAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{" "}
          • {startsAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} •{" "}
          {ticket.showtime.screenName}
        </p>
        <p className="text-xs text-[#a5b4fc] mt-0.5">
          Seats {ticket.seats.map((s) => s.label).join(", ")} • {ticket.bookingReference}
        </p>
      </div>
      <span
        className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
          statusLabel === "Active"
            ? "bg-emerald-950/60 border border-emerald-500/50 text-emerald-300"
            : "bg-zinc-800 text-zinc-400"
        }`}
      >
        {statusLabel}
      </span>
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
              <h2 className="text-xs uppercase font-bold tracking-widest text-[#a5b4fc]">
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
                <h2 className="text-xs uppercase font-bold tracking-widest text-zinc-500">
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
