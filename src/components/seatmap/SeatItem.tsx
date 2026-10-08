// src/components/seatmap/SeatItem.tsx
// Individual seat button with status styling and hover tooltip

import { SeatLayoutItem } from "@/types";

interface SeatItemProps {
  seat: SeatLayoutItem;
  isSelected: boolean;
  onToggle: (seat: SeatLayoutItem) => void;
  disabled?: boolean;
}

export default function SeatItem({ seat, isSelected, onToggle, disabled }: SeatItemProps) {
  const isBooked = seat.status === "BOOKED";
  const isHeldByOther = seat.status === "HELD" && !seat.isHeldByMe;

  let bgClass = "bg-[#0b0c2a] border-white/20 text-zinc-300 hover:border-[#5938ff] hover:text-white";
  let title = `Row ${seat.rowLabel}, Seat ${seat.seatNum} (฿${seat.price} ${seat.tier})`;

  if (isBooked) {
    bgClass = "bg-zinc-900/60 border-zinc-800 text-zinc-700 cursor-not-allowed";
    title = `Row ${seat.rowLabel}, Seat ${seat.seatNum} — Sold Out`;
  } else if (isHeldByOther) {
    bgClass = "bg-amber-950/40 border-amber-500/40 text-amber-500/60 cursor-not-allowed animate-pulse";
    title = `Row ${seat.rowLabel}, Seat ${seat.seatNum} — Held by another customer`;
  } else if (isSelected) {
    bgClass = "bg-[#2500f0] border-white text-white shadow-[0_0_16px_rgba(37,0,240,0.9)] scale-110 z-10";
    title = `Row ${seat.rowLabel}, Seat ${seat.seatNum} — Selected (฿${seat.price})`;
  } else if (seat.isHeldByMe) {
    bgClass = "bg-[#5938ff]/40 border-[#5938ff] text-white shadow-[0_0_10px_rgba(89,56,255,0.5)]";
    title = `Row ${seat.rowLabel}, Seat ${seat.seatNum} — Reserved for you`;
  }

  const isClickable = !isBooked && !isHeldByOther && !disabled;

  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={() => onToggle(seat)}
      title={title}
      className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-t-xl rounded-b-md border text-[11px] font-bold flex items-center justify-center transition-all duration-200 ${bgClass}`}
    >
      <span>{seat.seatNum}</span>
    </button>
  );
}
