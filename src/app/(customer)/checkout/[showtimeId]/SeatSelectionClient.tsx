// src/app/(customer)/checkout/[showtimeId]/SeatSelectionClient.tsx
// Real-time seat selection with SWR 5s background polling & temporary 5-min holds.
// Phase 9: with PAYMENT_PROVIDER=stripe, "Pay" opens a PromptPay QR (10-min window) instead of
// the simulated instant payment.

"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { cinemaDayOf, formatCinemaDayLabel, formatCinemaTime } from "@/lib/schedule";
import SeatMap from "@/components/seatmap/SeatMap";
import SeatLegend from "@/components/seatmap/SeatLegend";
import SeatHoldTimer from "@/components/seatmap/SeatHoldTimer";
import PromptPayPanel from "@/components/checkout/PromptPayPanel";
import {
  PaymentProviderName,
  PromptPayCheckout,
  SeatLayoutItem,
  ShowtimeSeatMapResponse,
  StartPaymentResponse,
} from "@/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Props {
  showtimeId: string;
  initialData: ShowtimeSeatMapResponse;
  paymentProvider: PaymentProviderName;
  initialCheckout: PromptPayCheckout | null; // an open PromptPay payment survives a reload
}

export default function SeatSelectionClient({
  showtimeId,
  initialData,
  paymentProvider,
  initialCheckout,
}: Props) {
  const myHeldSeats = initialData.seats.filter((s) => s.isHeldByMe);
  const initialHeldUntil = myHeldSeats[0]?.heldUntil || null;

  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>(() =>
    myHeldSeats.map((s) => s.id),
  );
  // Seats actually held on the server (may differ from selection until re-locked)
  const [heldSeatIds, setHeldSeatIds] = useState<string[]>(() =>
    myHeldSeats.map((s) => s.id),
  );
  const [heldUntil, setHeldUntil] = useState<string | null>(initialHeldUntil);
  const [isHolding, setIsHolding] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<PromptPayCheckout | null>(
    initialCheckout,
  );
  const router = useRouter();

  // SWR background polling every 5 seconds
  const { data, mutate } = useSWR<ShowtimeSeatMapResponse>(
    `/api/showtimes/${showtimeId}/seats`,
    fetcher,
    {
      fallbackData: initialData,
      refreshInterval: 5000,
      revalidateOnFocus: true,
    },
  );

  const seatMapData = data || initialData;
  const { showtime, seats } = seatMapData;

  const selectedSeats = seats.filter((s) => selectedSeatIds.includes(s.id));
  const totalPrice = selectedSeats.reduce((sum, s) => sum + s.price, 0);
  const isSelectionHeld =
    heldUntil !== null &&
    selectedSeatIds.length > 0 &&
    selectedSeatIds.every((id) => heldSeatIds.includes(id));

  // Release a single held seat on the server when the customer deselects it
  const releaseHeldSeat = useCallback(
    async (seatId: string) => {
      const remaining = heldSeatIds.filter((id) => id !== seatId);
      setHeldSeatIds(remaining);
      if (remaining.length === 0) setHeldUntil(null);
      try {
        await fetch(`/api/showtimes/${showtimeId}/seats/release`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seatIds: [seatId] }),
        });
      } finally {
        await mutate();
      }
    },
    [showtimeId, heldSeatIds, mutate],
  );

  // Toggle seat selection
  const handleToggleSeat = useCallback(
    (seat: SeatLayoutItem) => {
      setErrorMsg(null);
      const isDeselecting = selectedSeatIds.includes(seat.id);
      setSelectedSeatIds((prev) =>
        isDeselecting
          ? prev.filter((id) => id !== seat.id)
          : [...prev, seat.id],
      );
      if (isDeselecting && heldSeatIds.includes(seat.id)) {
        void releaseHeldSeat(seat.id);
      }
    },
    [selectedSeatIds, heldSeatIds, releaseHeldSeat],
  );

  // Hold seats (Lock selection for 5 minutes)
  const handleHoldSeats = async () => {
    if (!selectedSeatIds.length) return;
    setIsHolding(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/showtimes/${showtimeId}/seats/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatIds: selectedSeatIds }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Failed to hold seats");
        await mutate(); // Refresh seat states
      } else {
        setHeldUntil(json.heldUntil);
        setHeldSeatIds(json.heldSeatIds ?? selectedSeatIds);
        await mutate();
      }
    } catch {
      setErrorMsg("Network error reserving seats");
    } finally {
      setIsHolding(false);
    }
  };

  // Simulated: server re-validates the hold and prices, then issues the ticket at once.
  // Stripe: server does the same checks, extends the hold once, and returns a PromptPay QR.
  const handlePayment = async () => {
    setIsPaying(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showtimeId }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Payment failed");
        setIsPaying(false);
        await mutate();
        return;
      }

      const started = json as StartPaymentResponse;
      if (started.provider === "stripe") {
        setCheckout(started.checkout);
        setIsPaying(false);
        await mutate();
        return;
      }

      // Keep the button disabled while navigating to the ticket pass
      router.push(`/tickets/${started.ticketId}?paid=1`);
    } catch {
      setErrorMsg("Network error processing payment");
      setIsPaying(false);
    }
  };

  // PromptPay finished without a ticket (cancelled, expired, failed, refunded): seats are released
  const handlePaymentClosed = async (message: string) => {
    setCheckout(null);
    setHeldUntil(null);
    setHeldSeatIds([]);
    setSelectedSeatIds([]);
    setErrorMsg(message);
    await mutate();
  };

  // Release seats when timer expires
  const handleExpire = async () => {
    setHeldUntil(null);
    setHeldSeatIds([]);
    setSelectedSeatIds([]);
    setErrorMsg(
      "Your 5-minute seat reservation has expired. Please select again.",
    );
    // No seatIds → releases every seat in this user's pending booking
    await fetch(`/api/showtimes/${showtimeId}/seats/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await mutate();
  };

  const startsAt = new Date(showtime.startsAt);
  const currentStep =
    checkout || isSelectionHeld ? 3 : selectedSeats.length > 0 ? 2 : 1;

  // Group the selection by tier for a compact price breakdown (e.g. "2 × VIP ฿280")
  const tierBreakdown = (["VIP", "PREMIUM", "STANDARD"] as const)
    .map((tier) => {
      const tierSeats = selectedSeats.filter((s) => s.tier === tier);
      return {
        tier,
        count: tierSeats.length,
        unitPrice: tierSeats[0]?.price ?? 0,
        subtotal: tierSeats.reduce((sum, s) => sum + s.price, 0),
      };
    })
    .filter((row) => row.count > 0);

  const helperText = isSelectionHeld
    ? paymentProvider === "stripe"
      ? "Pay by scanning a PromptPay QR with any Thai banking app. You get 10 minutes to pay. Test mode: no real money is charged."
      : "Test mode: no real money is charged. Your ticket appears right after."
    : heldUntil
      ? "You changed your seats. Re-lock them to continue to payment."
      : selectedSeats.length > 0
        ? "Locking holds these seats for 5 minutes so nobody else can take them."
        : "Tap any available seat on the map to start.";

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Movie & Showtime Header */}
      <header className="flex items-center gap-4 pb-6 border-b border-[#2500f0]/30">
        <div className="relative w-14 h-20 shrink-0 rounded-xl overflow-hidden border border-white/20">
          <Image
            src={showtime.movie.posterUrl}
            alt={showtime.movie.title}
            fill
            sizes="56px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">
            {showtime.movie.title}
          </h1>
          <p className="text-sm text-zinc-300 mt-1">
            {/* Bangkok time, the same as the showtime picker (not the browser's time zone) */}
            {formatCinemaDayLabel(cinemaDayOf(startsAt))} · {formatCinemaTime(startsAt)}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {showtime.screen.name} · {showtime.screen.format} ·{" "}
            {showtime.screen.cinemaName}
          </p>
        </div>
        {/* Hidden while a PromptPay payment is open: its panel has Cancel, which releases the seats */}
        {!checkout && (
          <Link
            href={`/movies/${showtime.movie.id}?date=${cinemaDayOf(startsAt)}`}
            onClick={() => {
              // Give held seats back right away instead of blocking them for up to 5 minutes
              if (heldSeatIds.length > 0) {
                void fetch(`/api/showtimes/${showtimeId}/seats/release`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({}),
                  keepalive: true, // survives the navigation
                });
              }
            }}
            className="ml-auto shrink-0 self-start rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-[#5938ff] hover:bg-white/[0.04]"
          >
            Change showtime
          </Link>
        )}
      </header>

      {/* Step indicator */}
      <ol
        className="flex items-center gap-2 text-xs font-bold"
        aria-label="Checkout progress"
      >
        {["Select seats", "Lock for 5 min", "Pay"].map((label, i) => {
          const step = i + 1;
          const state =
            step < currentStep
              ? "done"
              : step === currentStep
                ? "current"
                : "todo";
          return (
            <li
              key={label}
              className="flex items-center gap-2"
              aria-current={state === "current" ? "step" : undefined}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                  state === "done"
                    ? "bg-emerald-600 border-emerald-500 text-white"
                    : state === "current"
                      ? "bg-[#2500f0] border-[#5938ff] text-white"
                      : "border-white/20 text-zinc-500"
                }`}
              >
                {state === "done" ? "✓" : step}
              </span>
              <span
                className={state === "todo" ? "text-zinc-500" : "text-white"}
              >
                {label}
              </span>
              {step < 3 && (
                <span className="w-6 sm:w-10 h-px bg-white/15" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      <div className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">
        {/* Seat Map + Legend */}
        <div className="space-y-6 min-w-0">
          <SeatMap
            seats={seats}
            selectedSeatIds={selectedSeatIds}
            onToggleSeat={handleToggleSeat}
            screenName={`${showtime.screen.name} · ${showtime.screen.format}`}
            isHolding={isHolding || isPaying || checkout !== null}
          />
          <SeatLegend />
        </div>

        {/* Booking Panel — full sticky sidebar on desktop, compact sticky bar on mobile
            (details are desktop-only so the bar never covers the seat map) */}
        <aside
          className={`${checkout ? "lg:sticky" : "sticky bottom-3 lg:bottom-auto"} lg:top-24 z-40 p-3 lg:p-5 rounded-2xl bg-[#06071d]/95 border border-[#2500f0]/50 backdrop-blur-xl shadow-2xl space-y-3 lg:space-y-4`}
        >
          {checkout ? (
            <PromptPayPanel
              checkout={checkout}
              onPaid={(ticketId) => router.push(`/tickets/${ticketId}?paid=1`)}
              onClosed={handlePaymentClosed}
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <h2 className="hidden lg:block text-sm font-bold text-white">
                  Your booking
                </h2>
                <p className="lg:hidden min-w-0 text-sm">
                  {selectedSeats.length === 0 ? (
                    <span className="text-zinc-400">No seats selected</span>
                  ) : (
                    <>
                      <span className="font-bold text-white">
                        {selectedSeats
                          .map((s) => `${s.rowLabel}${s.seatNum}`)
                          .join(", ")}
                      </span>
                      <span className="text-zinc-300">
                        {" "}
                        · ฿{totalPrice.toLocaleString()}
                      </span>
                    </>
                  )}
                </p>
                <SeatHoldTimer heldUntil={heldUntil} onExpire={handleExpire} />
              </div>

              {selectedSeats.length === 0 ? (
                <p className="hidden lg:block text-sm text-zinc-400">
                  No seats selected yet.
                </p>
              ) : (
                <div className="hidden lg:block space-y-4">
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSeats.map((s) => (
                      <span
                        key={s.id}
                        className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                          heldSeatIds.includes(s.id)
                            ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-200"
                            : "bg-[#2500f0]/25 border-[#5938ff]/60 text-white"
                        }`}
                      >
                        {s.rowLabel}
                        {s.seatNum}
                      </span>
                    ))}
                  </div>

                  <dl className="space-y-1.5 text-sm">
                    {tierBreakdown.map((row) => (
                      <div
                        key={row.tier}
                        className="flex justify-between text-zinc-300"
                      >
                        <dt>
                          {row.count} ×{" "}
                          {row.tier.charAt(0) + row.tier.slice(1).toLowerCase()}{" "}
                          <span className="text-zinc-500">
                            ฿{row.unitPrice.toLocaleString()}
                          </span>
                        </dt>
                        <dd>฿{row.subtotal.toLocaleString()}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between items-baseline pt-2 border-t border-white/15">
                      <dt className="text-zinc-300">Total</dt>
                      <dd className="text-2xl font-black text-white">
                        ฿{totalPrice.toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              {errorMsg && (
                <p
                  role="alert"
                  className="p-3 rounded-xl bg-red-950/50 border border-red-500/50 text-red-200 text-sm"
                >
                  {errorMsg}
                </p>
              )}

              {!isSelectionHeld ? (
                <button
                  type="button"
                  disabled={selectedSeats.length === 0 || isHolding}
                  onClick={handleHoldSeats}
                  className="w-full px-6 py-3.5 rounded-xl bg-[#2500f0] hover:bg-[#3411ff] disabled:opacity-40 text-white font-bold text-sm transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {isHolding
                    ? "Locking seats…"
                    : heldUntil
                      ? "Update locked seats"
                      : selectedSeats.length > 0
                        ? `Lock ${selectedSeats.length} seat${selectedSeats.length > 1 ? "s" : ""}`
                        : "Select seats to continue"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isPaying}
                  onClick={handlePayment}
                  className="w-full px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {isPaying
                    ? paymentProvider === "stripe"
                      ? "Preparing PromptPay QR…"
                      : "Processing payment…"
                    : paymentProvider === "stripe"
                      ? `Pay ฿${totalPrice.toLocaleString()} with PromptPay`
                      : `Pay ฿${totalPrice.toLocaleString()}`}
                </button>
              )}

              <p className="hidden lg:block text-xs text-zinc-400 leading-relaxed">
                {helperText}
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
