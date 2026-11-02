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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/login?callbackUrl=/tickets/${id}`);
  }

  const ticket = await getTicketPassForUser(id, session.user.id);
  if (!ticket) {
    notFound();
  }

  const startsAt = new Date(ticket.showtime.startsAt);
  const isUsed = ticket.status === "USED";

  return (
    <main className="min-h-screen bg-[#02020a] text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto space-y-6">
        <Link
          href="/tickets"
          className="text-xs font-bold text-[#c7d2fe] hover:text-white transition-colors"
        >
          ← My Tickets
        </Link>

        <article className="rounded-3xl overflow-hidden border border-[#2500f0]/40 bg-[#06071d] shadow-2xl shadow-[#2500f0]/20">
          {/* Movie header */}
          <div className="flex items-center gap-4 p-6 border-b border-dashed border-white/20">
            <div className="relative w-16 h-24 shrink-0 rounded-xl overflow-hidden border border-white/20">
              <Image
                src={ticket.movie.posterUrl}
                alt={ticket.movie.title}
                fill
                className="object-cover"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black leading-tight">{ticket.movie.title}</h1>
              <p className="text-xs text-zinc-400 mt-1">
                {ticket.showtime.screenName} • {ticket.showtime.cinemaName}
              </p>
              <p className="text-xs text-[#a5b4fc] mt-0.5">
                {startsAt.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}{" "}
                •{" "}
                {startsAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>

          {/* QR code */}
          <div className="flex flex-col items-center gap-3 p-6 border-b border-dashed border-white/20">
            <div className={isUsed ? "opacity-30 grayscale" : ""}>
              <TicketQRCode payload={ticket.qrPayload} />
            </div>
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                isUsed
                  ? "bg-zinc-800 text-zinc-400"
                  : "bg-emerald-950/60 border border-emerald-500/50 text-emerald-300"
              }`}
            >
              {isUsed ? "Used" : "Valid for entry"}
            </span>
            <p className="text-[10px] text-zinc-500 font-mono break-all text-center">
              {ticket.ticketCode}
            </p>
          </div>

          {/* Details */}
          <dl className="grid grid-cols-2 gap-4 p-6 text-sm">
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-zinc-500">Booking Ref</dt>
              <dd className="font-mono font-bold">{ticket.bookingReference}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-zinc-500">Screen</dt>
              <dd className="font-bold">{ticket.showtime.screenName}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[10px] uppercase tracking-widest text-zinc-500">Seats</dt>
              <dd className="flex flex-wrap gap-2 mt-1">
                {ticket.seats.map((seat) => (
                  <span
                    key={seat.label}
                    className="px-2 py-1 rounded-lg bg-[#2500f0]/20 border border-[#2500f0]/40 text-xs font-bold"
                  >
                    {seat.label}
                    <span className="ml-1 text-[9px] text-zinc-400">{seat.tier}</span>
                  </span>
                ))}
              </dd>
            </div>
            <div className="col-span-2 flex items-center justify-between pt-3 border-t border-white/10">
              <dt className="text-xs text-zinc-400">Total Paid</dt>
              <dd className="text-lg font-black">฿{ticket.totalAmount.toLocaleString()}</dd>
            </div>
          </dl>
        </article>
      </div>
    </main>
  );
}
