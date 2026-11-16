"use client";
// Themed date picker for admin forms. The browser's <input type="date"> popup can't be styled,
// so this draws its own month grid. Days are "YYYY-MM-DD" calendar strings (Bangkok days), no time zone maths.

import { useEffect, useId, useRef, useState } from "react";
import { addCinemaDays, formatCinemaDate } from "@/lib/schedule";

interface Props {
  value: string; // "YYYY-MM-DD"
  min?: string; // earliest pickable day
  today: string; // Bangkok today, from the server clock
  onChange: (day: string) => void;
  label: string;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const monthOf = (day: string) => day.slice(0, 7); // "YYYY-MM"
const atNoonUtc = (day: string) => new Date(`${day}T12:00:00Z`);

function shiftMonth(month: string, by: number): string {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
}

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    atNoonUtc(`${month}-01`)
  );
}

/** 6 weeks × 7 days, Monday first, covering `month`. */
function monthGrid(month: string): string[] {
  const first = `${month}-01`;
  const mondayOffset = (atNoonUtc(first).getUTCDay() + 6) % 7;
  const start = addCinemaDays(first, -mondayOffset);
  return Array.from({ length: 42 }, (_, i) => addCinemaDays(start, i));
}

function fullLabel(day: string): string {
  return `${formatCinemaDate(day)} ${day.slice(0, 4)}`; // "Mon 16 Nov 2026"
}

export default function CinemaDatePicker({ value, min, today, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthOf(value));
  const [focusDay, setFocusDay] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const popupId = useId();

  const isDisabled = (day: string) => (min ? day < min : false);

  function openPicker() {
    setMonth(monthOf(value));
    setFocusDay(value);
    setOpen(true);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function pick(day: string) {
    if (isDisabled(day)) return;
    close(true);
    onChange(day);
  }

  // Close on a click or tap outside
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep keyboard focus on the roving day
  useEffect(() => {
    if (!open) return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
  }, [open, focusDay]); // not on month: the ‹ › buttons keep their own focus

  function moveFocus(next: string) {
    const clamped = min && next < min ? min : next;
    setFocusDay(clamped);
    if (monthOf(clamped) !== month) setMonth(monthOf(clamped));
  }

  function onGridKeyDown(e: React.KeyboardEvent) {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addCinemaDays(focusDay, -1),
      ArrowRight: () => addCinemaDays(focusDay, 1),
      ArrowUp: () => addCinemaDays(focusDay, -7),
      ArrowDown: () => addCinemaDays(focusDay, 7),
      PageUp: () => addCinemaDays(focusDay, -28),
      PageDown: () => addCinemaDays(focusDay, 28),
    };
    if (moves[e.key]) {
      e.preventDefault();
      moveFocus(moves[e.key]());
    }
  }

  const canGoBack = !min || shiftMonth(month, -1) >= monthOf(min);

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close(true);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label}: ${fullLabel(value)}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        onClick={() => (open ? close(false) : openPicker())}
        className={`mt-1 flex min-h-10 w-full items-center gap-2.5 rounded-xl border bg-black/40 px-3 py-2 text-left text-sm normal-case tracking-normal text-white transition-colors focus-visible:border-[#5938ff] focus-visible:shadow-[0_0_0_3px_rgba(89,56,255,0.35)] focus-visible:outline-none ${
          open
            ? "border-[#5938ff] shadow-[0_0_0_3px_rgba(89,56,255,0.35)]"
            : "border-white/15 hover:border-[#5938ff]/70 hover:bg-[#0d0f33]/60"
        }`}
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="#c7d2fe" strokeWidth="1.6" className="h-4 w-4 shrink-0" aria-hidden>
          <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" />
          <path d="M3 8.5h14M7 2.75v3.5M13 2.75v3.5" strokeLinecap="round" />
        </svg>
        <span className="flex-1 font-semibold">{fullLabel(value)}</span>
        {value === today && (
          <span className="rounded-full bg-[#2500f0]/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#c7d2fe]">
            Today
          </span>
        )}
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="#c7d2fe"
          strokeWidth="1.8"
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          id={popupId}
          role="dialog"
          aria-label={`Choose ${label.toLowerCase()}`}
          className="absolute left-0 right-0 z-30 mt-2 rounded-2xl border border-[#5938ff]/45 bg-[#0d0f33] p-3 normal-case tracking-normal shadow-[0_18px_40px_-12px_rgba(0,0,0,0.85),0_0_24px_rgba(37,0,240,0.35)]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              disabled={!canGoBack}
              onClick={() => setMonth(shiftMonth(month, -1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-zinc-200 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
            >
              ‹
            </button>
            <p className="text-sm font-bold text-white" aria-live="polite">
              {monthLabel(month)}
            </p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth(shiftMonth(month, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-zinc-200 hover:bg-white/[0.08]"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-zinc-500" aria-hidden>
            {WEEKDAYS.map((w) => (
              <span key={w} className="py-1">
                {w}
              </span>
            ))}
          </div>

          <div ref={gridRef} className="grid grid-cols-7 gap-1" onKeyDown={onGridKeyDown}>
            {monthGrid(month).map((day) => {
              const inMonth = monthOf(day) === month;
              const selected = day === value;
              const disabled = isDisabled(day);
              return (
                <button
                  key={day}
                  type="button"
                  data-day={day}
                  tabIndex={day === focusDay ? 0 : -1}
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-current={day === today ? "date" : undefined}
                  aria-label={fullLabel(day)}
                  onClick={() => pick(day)}
                  className={`relative flex h-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5938ff] ${
                    selected
                      ? "bg-[#2500f0] font-bold text-white shadow-[0_4px_14px_-2px_rgba(37,0,240,0.7)]"
                      : disabled
                        ? "cursor-not-allowed text-zinc-700"
                        : `${inMonth ? "text-zinc-100" : "text-zinc-500"} hover:bg-[#5938ff]/25`
                  } ${day === today && !selected ? "ring-1 ring-inset ring-[#5938ff]/70" : ""}`}
                >
                  {Number(day.slice(8))}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex justify-between border-t border-white/10 pt-2">
            <button
              type="button"
              onClick={() => pick(today)}
              disabled={isDisabled(today)}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#c7d2fe] hover:bg-white/[0.08] disabled:opacity-30"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => close(true)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:bg-white/[0.08]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
