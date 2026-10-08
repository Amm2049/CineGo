// src/app/(customer)/checkout/[showtimeId]/SeatSelectionClient.tsx
// Real-time seat selection with SWR 5s background polling & temporary 5-min holds

"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import useSWR from "swr";
import SeatMap from "@/components/seatmap/SeatMap";
import SeatLegend from "@/components/seatmap/SeatLegend";
import SeatHoldTimer from "@/components/seatmap/SeatHoldTimer";
import { SeatLayoutItem, ShowtimeSeatMapResponse } from "@/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Props {
  showtimeId: string;
  initialData: ShowtimeSeatMapResponse;
}

export default function SeatSelectionClient({ showtimeId, initialData }: Props) {
  const myHeldSeats = initialData.seats.filter((s) => s.isHeldByMe);
  const initialHeldUntil = myHeldSeats[0]?.heldUntil || null;

  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>(() =>
    myHeldSeats.map((s) => s.id)
  );
  const [heldUntil, setHeldUntil] = useState<string | null>(initialHeldUntil);
  const [isHolding, setIsHolding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // SWR background polling every 5 seconds
  const { data, mutate } = useSWR<ShowtimeSeatMapResponse>(
    `/api/showtimes/${showtimeId}/seats`,
    fetcher,
    {
      fallbackData: initialData,
      refreshInterval: 5000,
      revalidateOnFocus: true,
    }
  );

  const seatMapData = data || initialData;
  const { showtime, seats, pricing } = seatMapData;

  const selectedSeats = seats.filter((s) => selectedSeatIds.includes(s.id));
  const totalPrice = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  // Toggle seat selection
  const handleToggleSeat = useCallback((seat: SeatLayoutItem) => {
    setErrorMsg(null);
    setSelectedSeatIds((prev) =>
      prev.includes(seat.id) ? prev.filter((id) => id !== seat.id) : [...prev, seat.id]
    );
  }, []);

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
        await mutate();
      }
    } catch {
      setErrorMsg("Network error reserving seats");
    } finally {
      setIsHolding(false);
    }
  };

  // Release seats when timer expires
  const handleExpire = async () => {
    setHeldUntil(null);
    setSelectedSeatIds([]);
    setErrorMsg("Your 5-minute seat reservation has expired. Please select again.");
    await fetch(`/api/showtimes/${showtimeId}/seats/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seatIds: selectedSeatIds }),
    });
    await mutate();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Movie & Showtime Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-[#2500f0]/30">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-24 rounded-xl overflow-hidden border border-white/20">
            <Image
              src={showtime.movie.posterUrl}
              alt={showtime.movie.title}
              fill
              className="object-cover"
            />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">{showtime.movie.title}</h1>
            <p className="text-xs text-zinc-400 mt-1">
              {showtime.screen.name} • {showtime.screen.cinemaName}
            </p>
            <p className="text-xs text-[#a5b4fc] mt-0.5">
              {new Date(showtime.startsAt).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}{" "}
              •{" "}
              {new Date(showtime.startsAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        {/* Hold Countdown */}
        <SeatHoldTimer heldUntil={heldUntil} onExpire={handleExpire} />
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/50 border border-red-500/50 text-red-200 text-xs">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Seat Map Layout */}
      <SeatMap
        seats={seats}
        selectedSeatIds={selectedSeatIds}
        onToggleSeat={handleToggleSeat}
        screenName={showtime.screen.name}
        isHolding={isHolding}
      />

      <SeatLegend pricing={pricing} />

      {/* Floating Action / Checkout Bar */}
      <div className="sticky bottom-6 z-40 p-4 sm:p-6 rounded-2xl bg-[#06071d]/95 border border-[#2500f0]/50 backdrop-blur-xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs text-zinc-400">Selected Seats: </span>
          <span className="text-sm font-bold text-white">
            {selectedSeats.length > 0
              ? selectedSeats.map((s) => `${s.rowLabel}${s.seatNum}`).join(", ")
              : "None"}
          </span>
          <div className="text-lg font-black text-[#5938ff] mt-0.5">
            Total: ฿{totalPrice.toLocaleString()}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!heldUntil ? (
            <button
              type="button"
              disabled={selectedSeats.length === 0 || isHolding}
              onClick={handleHoldSeats}
              className="px-6 py-3 rounded-xl bg-[#2500f0] hover:bg-[#3411ff] disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#2500f0]/50 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isHolding ? "Holding Seats..." : "Lock Seats & Proceed (5 min)"}
            </button>
          ) : (
            <button
              type="button"
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/50 transition-all cursor-pointer"
              onClick={() => alert("Proceeding to Phase 7 Checkout & Payment!")}
            >
              Proceed to Payment →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
