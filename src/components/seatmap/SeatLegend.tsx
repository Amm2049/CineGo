// src/components/seatmap/SeatLegend.tsx
// Seat status legend (tier prices are shown as bands on the seat map itself)

const LEGEND_ITEMS = [
  { label: "Available", swatch: "bg-[#0b0c2a] border-white/20", text: "text-zinc-300" },
  { label: "Selected", swatch: "bg-[#2500f0] border-white", text: "text-white" },
  { label: "Locked for you", swatch: "bg-emerald-600 border-emerald-300", text: "text-emerald-300" },
  { label: "Held by others", swatch: "bg-amber-950/60 border-amber-500/50", text: "text-amber-400" },
  { label: "Sold", swatch: "bg-zinc-900 border-zinc-700", text: "text-zinc-400" },
];

export default function SeatLegend() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 py-3 px-4 rounded-2xl bg-[#06071d]/90 border border-[#2500f0]/30 text-xs">
      {LEGEND_ITEMS.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span className={`w-4 h-4 rounded-t-md rounded-b-sm border ${item.swatch}`} aria-hidden />
          <span className={item.text}>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
