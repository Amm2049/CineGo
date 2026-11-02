// src/components/seatmap/SeatMap.tsx
// Interactive seat map layout with row indicators, price-tier bands, and center aisle

import ScreenCurve from "./ScreenCurve";
import SeatItem from "./SeatItem";
import { SeatLayoutItem, SeatTier } from "@/types";

interface SeatMapProps {
  seats: SeatLayoutItem[];
  selectedSeatIds: string[];
  onToggleSeat: (seat: SeatLayoutItem) => void;
  screenName?: string;
  isHolding?: boolean;
}

const TIER_LABELS: Record<SeatTier, string> = {
  VIP: "VIP",
  PREMIUM: "Premium",
  STANDARD: "Standard",
};

export default function SeatMap({
  seats,
  selectedSeatIds,
  onToggleSeat,
  screenName,
  isHolding,
}: SeatMapProps) {
  // Group seats by row
  const rows = Array.from(new Set(seats.map((s) => s.rowLabel))).sort();

  const renderSeat = (seat: SeatLayoutItem) => (
    <SeatItem
      key={seat.id}
      seat={seat}
      isSelected={selectedSeatIds.includes(seat.id)}
      onToggle={onToggleSeat}
      disabled={isHolding}
    />
  );

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
      <ScreenCurve screenName={screenName} />

      {/* Grid Container — scrolls instead of clipping if a screen is too narrow */}
      <div className="w-full py-5 px-2 sm:px-8 rounded-3xl bg-[#030414]/90 border border-[#2500f0]/30 shadow-2xl overflow-x-auto">
        <div className="w-max mx-auto space-y-2 sm:space-y-3">
          {rows.map((rowLabel, index) => {
            const rowSeats = seats
              .filter((s) => s.rowLabel === rowLabel)
              .sort((a, b) => a.seatNum - b.seatNum);
            const tier = rowSeats[0]?.tier;
            const prevTier = index > 0 ? seats.find((s) => s.rowLabel === rows[index - 1])?.tier : undefined;
            const startsTierBand = tier && tier !== prevTier;

            return (
              <div key={rowLabel}>
                {/* Price-tier band label, shown above the first row of each tier */}
                {startsTierBand && (
                  <div className={`flex items-center gap-2 ${index > 0 ? "pt-3 sm:pt-4" : ""} pb-1.5`}>
                    <span className="h-px flex-1 bg-white/10" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                      {TIER_LABELS[tier]} · ฿{rowSeats[0].price.toLocaleString()}
                    </span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                )}

                <div className="flex items-center justify-center gap-1 sm:gap-3">
                  {/* Left Row Indicator */}
                  <span className="w-4 sm:w-6 text-center text-xs font-black text-[#5938ff]">
                    {rowLabel}
                  </span>

                  {/* Seats with Center Aisle after Seat 5 */}
                  <div className="flex items-center gap-1 sm:gap-2">
                    {rowSeats.slice(0, 5).map(renderSeat)}

                    {/* Center Aisle */}
                    <div className="w-2 sm:w-8" />

                    {rowSeats.slice(5).map(renderSeat)}
                  </div>

                  {/* Right Row Indicator (hidden on phones to save width) */}
                  <span className="hidden sm:block w-6 text-center text-xs font-black text-[#5938ff]">
                    {rowLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
