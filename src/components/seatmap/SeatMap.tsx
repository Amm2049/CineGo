// src/components/seatmap/SeatMap.tsx
// Interactive seat map layout with row indicators and center aisle

import ScreenCurve from "./ScreenCurve";
import SeatItem from "./SeatItem";
import { SeatLayoutItem } from "@/types";

interface SeatMapProps {
  seats: SeatLayoutItem[];
  selectedSeatIds: string[];
  onToggleSeat: (seat: SeatLayoutItem) => void;
  screenName?: string;
  isHolding?: boolean;
}

export default function SeatMap({
  seats,
  selectedSeatIds,
  onToggleSeat,
  screenName,
  isHolding,
}: SeatMapProps) {
  // Group seats by row
  const rows = Array.from(new Set(seats.map((s) => s.rowLabel))).sort();

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
      <ScreenCurve screenName={screenName} />

      {/* Grid Container */}
      <div className="space-y-3 py-6 px-4 sm:px-8 rounded-3xl bg-[#030414]/90 border border-[#2500f0]/30 shadow-2xl overflow-x-auto max-w-full">
        {rows.map((rowLabel) => {
          const rowSeats = seats
            .filter((s) => s.rowLabel === rowLabel)
            .sort((a, b) => a.seatNum - b.seatNum);

          return (
            <div key={rowLabel} className="flex items-center justify-center gap-2 sm:gap-3">
              {/* Left Row Indicator */}
              <span className="w-6 text-center text-xs font-black text-[#5938ff]">{rowLabel}</span>

              {/* Seats with Center Aisle after Seat 5 */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {rowSeats.slice(0, 5).map((seat) => (
                  <SeatItem
                    key={seat.id}
                    seat={seat}
                    isSelected={selectedSeatIds.includes(seat.id)}
                    onToggle={onToggleSeat}
                    disabled={isHolding}
                  />
                ))}

                {/* Center Aisle */}
                <div className="w-4 sm:w-8" />

                {rowSeats.slice(5).map((seat) => (
                  <SeatItem
                    key={seat.id}
                    seat={seat}
                    isSelected={selectedSeatIds.includes(seat.id)}
                    onToggle={onToggleSeat}
                    disabled={isHolding}
                  />
                ))}
              </div>

              {/* Right Row Indicator */}
              <span className="w-6 text-center text-xs font-black text-[#5938ff]">{rowLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
