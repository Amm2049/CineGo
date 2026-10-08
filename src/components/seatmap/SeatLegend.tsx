// src/components/seatmap/SeatLegend.tsx
// Status legend and pricing breakdown

export default function SeatLegend({
  pricing,
}: {
  pricing: { standard: number; premium: number; vip: number };
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 py-4 px-6 rounded-2xl bg-[#06071d]/90 border border-[#2500f0]/30 text-xs">
      {/* Statuses */}
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-t-lg rounded-b-sm bg-[#0b0c2a] border border-white/20" />
        <span className="text-zinc-400">Available</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-t-lg rounded-b-sm bg-[#2500f0] border border-white shadow-[0_0_10px_rgba(37,0,240,0.8)]" />
        <span className="text-white font-semibold">Selected</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-t-lg rounded-b-sm bg-amber-950/60 border border-amber-500/50" />
        <span className="text-amber-400">Held</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-t-lg rounded-b-sm bg-zinc-900 border border-zinc-800" />
        <span className="text-zinc-600">Sold</span>
      </div>

      {/* Pricing Tiers */}
      <div className="h-4 w-px bg-white/10 hidden sm:block" />

      <div className="flex items-center gap-4 text-[11px] text-zinc-300">
        <span>VIP (A–B): <strong className="text-white">฿{pricing.vip}</strong></span>
        <span>Premium (C–D): <strong className="text-white">฿{pricing.premium}</strong></span>
        <span>Standard (E–F): <strong className="text-white">฿{pricing.standard}</strong></span>
      </div>
    </div>
  );
}
