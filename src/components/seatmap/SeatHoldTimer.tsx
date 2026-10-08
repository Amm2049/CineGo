// src/components/seatmap/SeatHoldTimer.tsx
// 5-minute seat reservation countdown timer

"use client";

import { useEffect, useState } from "react";

interface SeatHoldTimerProps {
  heldUntil: string | null;
  onExpire: () => void;
}

export default function SeatHoldTimer({ heldUntil, onExpire }: SeatHoldTimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!heldUntil) {
      setSecondsRemaining(null);
      return;
    }

    const target = new Date(heldUntil).getTime();

    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((target - now) / 1000));
      setSecondsRemaining(diff);

      if (diff <= 0) {
        onExpire();
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [heldUntil, onExpire]);

  if (secondsRemaining === null || secondsRemaining <= 0) {
    return null;
  }

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const isUrgent = secondsRemaining < 60;

  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
        isUrgent
          ? "bg-red-950/60 border-red-500/70 text-red-200 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]"
          : "bg-amber-950/40 border-amber-500/50 text-amber-300"
      }`}
    >
      <span>⏱️ Seats held:</span>
      <span className="font-mono text-sm">
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
    </div>
  );
}
