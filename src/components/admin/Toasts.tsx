"use client";

// Tiny in-house toast notifications (no extra dependency)

import { useState } from "react";

export type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

let nextToastId = 1;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function push(kind: ToastKind, text: string) {
    const id = nextToastId++;
    setToasts((list) => [...list, { id, kind, text }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 5000);
  }

  return { toasts, push };
}

const STYLES: Record<ToastKind, string> = {
  success: "border-emerald-500/40 bg-emerald-950/90 text-emerald-200",
  error: "border-red-500/40 bg-red-950/90 text-red-200",
  info: "border-[#5938ff]/50 bg-[#0b0930]/90 text-[#c7d2fe]",
};

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} role="status" className={`rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${STYLES[t.kind]}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
