// src/components/seatmap/ScreenCurve.tsx
// Cinematic curved illuminated movie screen

export default function ScreenCurve({ screenName = "MAIN AUDITORIUM" }: { screenName?: string }) {
  return (
    <div className="relative w-full max-w-2xl mx-auto flex flex-col items-center mb-8 select-none">
      {/* Ambient Screen Light Projection */}
      <div className="w-4/5 h-8 bg-gradient-to-b from-[#5938ff]/25 to-transparent blur-xl pointer-events-none -mb-3" />

      {/* Curved Screen Border */}
      <div className="relative w-full h-10 overflow-hidden flex items-start justify-center">
        <div className="w-[120%] h-40 border-t-4 border-[#2500f0] rounded-[50%] shadow-[0_0_24px_rgba(37,0,240,0.8)]" />
      </div>

      <div className="flex items-center gap-2 -mt-4 text-[10px] font-black uppercase tracking-widest text-[#a5b4fc]/80">
        <span>▲</span>
        <span>{screenName} — SCREEN THIS WAY</span>
        <span>▲</span>
      </div>
    </div>
  );
}
