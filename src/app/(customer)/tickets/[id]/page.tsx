// src/app/(customer)/tickets/[id]/page.tsx
// Digital Ticket Pass — scannable QR code, seats, screen, showtime, and booking reference

import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTicketPassForUser } from "@/services/ticket.service";
import TicketQRCode from "@/components/tickets/TicketQRCode";

export const dynamic = "force-dynamic";

export default async function TicketPassPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const [{ id }, { paid }] = await Promise.all([params, searchParams]);
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/login?callbackUrl=/tickets/${id}`);
  }

  const ticket = await getTicketPassForUser(id, session.user.id);
  if (!ticket) {
    notFound();
  }

  const startsAt = new Date(ticket.showtime.startsAt);
  const endsAt = new Date(ticket.showtime.endsAt);
  const isUsed = ticket.status === "USED";
  const timeFormat: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

  return (
    <main className="min-h-screen bg-[#02020a] text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto space-y-5">
        <Link
          href="/tickets"
          className="inline-block text-sm font-bold text-[#c7d2fe] hover:text-white transition-colors"
        >
          ← My Tickets
        </Link>

        {paid === "1" && (
          <div
            role="status"
            className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/50"
          >
            <p className="font-bold text-emerald-200">✓ Payment confirmed</p>
            <p className="text-sm text-emerald-100/80 mt-0.5">
              Your seats are booked. This ticket is also saved in My Tickets.
            </p>
          </div>
        )}

        <article className="rounded-3xl overflow-hidden border border-[#2500f0]/40 bg-[#06071d] shadow-2xl shadow-[#2500f0]/20">
          {/* Movie header */}
          <div className="flex items-center gap-4 p-6">
            <div className="relative w-16 h-24 shrink-0 rounded-xl overflow-hidden border border-white/20">
              <Image
                src={ticket.movie.posterUrl}
                alt={ticket.movie.title}
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black leading-tight">{ticket.movie.title}</h1>
              <p className="text-sm text-zinc-200 mt-1.5">
                {startsAt.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <p className="text-sm text-[#c7d2fe]">
                {startsAt.toLocaleTimeString("en-US", timeFormat)} –{" "}
                {endsAt.toLocaleTimeString("en-US", timeFormat)}
              </p>
            </div>
          </div>

          {/* Key details: what staff and the customer actually look for */}
          <dl className="grid grid-cols-3 gap-3 px-6 pb-6 text-center">
            <div className="p-3 rounded-xl bg-white/[0.04]">
              <dt className="text-[11px] uppercase tracking-wider text-zinc-400">Screen</dt>
              <dd className="font-bold mt-0.5 text-sm">{ticket.showtime.screenName}</dd>
            </div>
            <div className="col-span-2 p-3 rounded-xl bg-white/[0.04]">
              <dt className="text-[11px] uppercase tracking-wider text-zinc-400">
                Seat{ticket.seats.length > 1 ? "s" : ""}
              </dt>
              <dd className="font-bold mt-0.5 text-sm">
                {ticket.seats.map((s) => s.label).join(", ")}
              </dd>
            </div>
          </dl>

          {/* Tear line */}
          <div className="relative h-0 border-t border-dashed border-white/20" aria-hidden>
            <span className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-[#02020a]" />
            <span className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-[#02020a]" />
          </div>

          {/* QR code */}
          <div className="flex flex-col items-center gap-3 p-6">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isUsed
                  ? "bg-zinc-800 text-zinc-300"
                  : "bg-emerald-950/60 border border-emerald-500/50 text-emerald-300"
              }`}
            >
              {isUsed ? "Already used" : "Valid for entry"}
            </span>
            <div className={isUsed ? "opacity-30 grayscale" : ""}>
              <TicketQRCode payload={ticket.qrPayload} />
            </div>
            <p className="text-sm text-zinc-300 text-center">
              {isUsed
                ? "This ticket has been scanned at the entrance."
                : "Show this QR code at the entrance. Turn up your screen brightness for faster scanning."}
            </p>

            <div className="w-full pt-4 mt-1 border-t border-white/10 text-center space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-zinc-400">Booking reference</p>
              <p className="text-2xl font-black font-mono tracking-wider">{ticket.bookingReference}</p>
            </div>

            <details className="w-full text-center">
              <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-200">
                QR not scanning? Show manual entry code
              </summary>
              <p className="mt-2 text-xs font-mono text-zinc-200 break-all select-all">
                {ticket.ticketCode}
              </p>
            </details>
          </div>

          {/* Price breakdown */}
          <div className="px-6 py-4 bg-white/[0.03] border-t border-white/10 space-y-1.5 text-sm">
            {ticket.seats.map((seat) => (
              <div key={seat.label} className="flex justify-between text-zinc-300">
                <span>
                  {seat.label}{" "}
                  <span className="text-zinc-400">
                    · {seat.tier.charAt(0) + seat.tier.slice(1).toLowerCase()}
                  </span>
                </span>
                <span>฿{seat.price.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between items-baseline pt-2 border-t border-white/10">
              <span className="text-zinc-300">Total paid</span>
              <span className="text-lg font-black">฿{ticket.totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </article>

        <p className="text-xs text-zinc-400 text-center">{ticket.showtime.cinemaName}</p>
      </div>
    </main>
  );
}
