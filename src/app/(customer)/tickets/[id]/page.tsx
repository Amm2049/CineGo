// src/app/(customer)/tickets/[id]/page.tsx
// Digital Ticket Pass for one booking — a scannable QR per seat, plus screen, showtime and booking reference

import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTicketPassForUser } from "@/services/ticket.service";
import TicketQRCode from "@/components/tickets/TicketQRCode";
import { CINEMA_TIME_ZONE } from "@/lib/schedule";

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

  const pass = await getTicketPassForUser(id, session.user.id);
  if (!pass) {
    notFound();
  }

  const startsAt = new Date(pass.showtime.startsAt);
  const endsAt = new Date(pass.showtime.endsAt);
  const total = pass.seats.length;
  const usedCount = pass.seats.filter((s) => s.status === "USED").length;
  const timeFormat: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23", // 24-hour, like the showtime picker
    timeZone: CINEMA_TIME_ZONE, // Vercel servers run in UTC
  };

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
              Your seats are booked. {total > 1 ? `Each of your ${total} seats has its own ticket below. ` : ""}
              They are also saved in My Tickets.
            </p>
          </div>
        )}

        {/* Booking summary */}
        <article className="rounded-3xl overflow-hidden border border-[#2500f0]/40 bg-[#06071d] shadow-2xl shadow-[#2500f0]/20">
          <div className="flex items-center gap-4 p-6">
            <div className="relative w-16 h-24 shrink-0 rounded-xl overflow-hidden border border-white/20">
              <Image
                src={pass.movie.posterUrl}
                alt={pass.movie.title}
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black leading-tight">{pass.movie.title}</h1>
              <p className="text-sm text-zinc-200 mt-1.5">
                {startsAt.toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: CINEMA_TIME_ZONE,
                })}
              </p>
              <p className="text-sm text-[#c7d2fe]">
                {startsAt.toLocaleTimeString("en-GB", timeFormat)} –{" "}
                {endsAt.toLocaleTimeString("en-GB", timeFormat)}
              </p>
            </div>
          </div>

          {/* Key details: what staff and the customer actually look for */}
          <dl className="grid grid-cols-3 gap-3 px-6 pb-6 text-center">
            <div className="p-3 rounded-xl bg-white/[0.04]">
              <dt className="text-[11px] uppercase tracking-wider text-zinc-400">Theatre</dt>
              <dd className="mt-0.5">
                <span className="block font-bold text-sm">{pass.showtime.screenNumber}</span>
                <span className="block text-[11px] text-zinc-400">{pass.showtime.screenFormat}</span>
              </dd>
            </div>
            <div className="col-span-2 p-3 rounded-xl bg-white/[0.04]">
              <dt className="text-[11px] uppercase tracking-wider text-zinc-400">
                Seat{total > 1 ? "s" : ""}
              </dt>
              <dd className="font-bold mt-0.5 text-sm">
                {pass.seats.map((s) => s.label).join(", ")}
              </dd>
            </div>
          </dl>

          <div className="px-6 pb-5 text-center space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-zinc-400">Booking reference</p>
            <p className="text-2xl font-black font-mono tracking-wider">{pass.bookingReference}</p>
          </div>

          {/* Price breakdown */}
          <div className="px-6 py-4 bg-white/[0.03] border-t border-white/10 space-y-1.5 text-sm">
            {pass.seats.map((seat) => (
              <div key={seat.id} className="flex justify-between text-zinc-300">
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
              <span className="text-lg font-black">฿{pass.totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </article>

        {/* One ticket per seat */}
        <section aria-labelledby="seat-tickets" className="space-y-3 pt-2">
          <div>
            <h2 id="seat-tickets" className="text-sm font-bold text-[#c7d2fe]">
              {total > 1 ? `Your ${total} tickets` : "Your ticket"}
              {usedCount > 0 && (
                <span className="text-zinc-400 font-normal"> · {usedCount} of {total} used</span>
              )}
            </h2>
            <p className="text-sm text-zinc-300 mt-1">
              {total > 1
                ? "One QR per seat. Each person shows their own seat's QR at the entrance."
                : "Show this QR code at the entrance."}{" "}
              Turn up your screen brightness for faster scanning.
            </p>
          </div>

          {pass.seats.map((seat, i) => {
            const isUsed = seat.status === "USED";
            return (
              <article
                key={seat.id}
                aria-label={`Ticket for seat ${seat.label}`}
                className="rounded-3xl border border-[#2500f0]/40 bg-[#06071d] overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3 px-6 pt-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-zinc-400">
                      Seat{total > 1 ? ` · ticket ${i + 1} of ${total}` : ""}
                    </p>
                    <p className="text-3xl font-black font-mono leading-tight">{seat.label}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      isUsed
                        ? "bg-zinc-800 text-zinc-300"
                        : "bg-emerald-950/60 border border-emerald-500/50 text-emerald-300"
                    }`}
                  >
                    {isUsed ? "Already used" : "Valid for entry"}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-3 p-6">
                  <div className={isUsed ? "opacity-30 grayscale" : ""}>
                    <TicketQRCode payload={seat.qrPayload} />
                  </div>
                  {isUsed && (
                    <p className="text-sm text-zinc-300 text-center">
                      Seat {seat.label} has been scanned at the entrance.
                    </p>
                  )}
                  <details className="w-full text-center">
                    <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-200">
                      QR not scanning? Show manual entry code
                    </summary>
                    <p className="mt-2 text-xs font-mono text-zinc-200 break-all select-all">
                      {seat.ticketCode}
                    </p>
                  </details>
                </div>
              </article>
            );
          })}
        </section>

        <p className="text-xs text-zinc-400 text-center">{pass.showtime.cinemaName}</p>
      </div>
    </main>
  );
}
