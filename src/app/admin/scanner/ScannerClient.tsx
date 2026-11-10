"use client";

import { useRef, useState } from "react";
import QrScanner from "@/components/admin/QrScanner";
import type { VerifyTicketResult } from "@/services/ticket.service";
import { formatCinemaDateTime, formatCinemaTime } from "@/lib/schedule";

type ScanResult = VerifyTicketResult | { outcome: "ERROR"; message: string };
type Outcome = ScanResult["outcome"];
type Tone = "good" | "bad" | "wait" | "error";

const DUPLICATE_WINDOW_MS = 4000; // the camera sees the same QR ~10 times per second

/** Per outcome: colour, title, a short label for the history, and what staff should do next. */
const OUTCOMES: Record<Outcome, { tone: Tone; title: string; label: string; next: string }> = {
  ADMITTED: {
    tone: "good",
    title: "Admit",
    label: "Admitted",
    next: "Let this one person in. Each seat has its own QR: scan every person in the group.",
  },
  ALREADY_USED: {
    tone: "bad",
    title: "Already used",
    label: "Already used",
    next: "Don't admit. This seat is already in; check they scanned their own seat's QR, or send them to the box office.",
  },
  NOT_FOUND: {
    tone: "bad",
    title: "Unknown ticket",
    label: "Unknown ticket",
    next: "Don't admit. Check the code, or send them to the box office.",
  },
  INVALID_CODE: {
    tone: "bad",
    title: "Not a CineGo ticket",
    label: "Not a CineGo ticket",
    next: "Ask them to open the ticket under My Tickets in CineGo and scan that QR.",
  },
  TOO_EARLY: {
    tone: "wait",
    title: "Too early",
    label: "Too early",
    next: "Don't admit yet. Ask them to come back when entry opens.",
  },
  SHOW_ENDED: {
    tone: "bad",
    title: "Show has ended",
    label: "Show ended",
    next: "Don't admit. This ticket was for a show that is over.",
  },
  ERROR: {
    tone: "error",
    title: "Could not verify",
    label: "Error",
    next: "Scan again, or enter the ticket code instead."
  },
};

const TONE_CARD: Record<Tone, string> = {
  good: "border-emerald-500 bg-emerald-950 text-emerald-50",
  bad: "border-red-500 bg-red-950 text-red-50",
  wait: "border-amber-500 bg-amber-950 text-amber-50",
  error: "border-zinc-500 bg-zinc-900 text-zinc-100",
};
const TONE_DOT: Record<Tone, string> = {
  good: "bg-emerald-400",
  bad: "bg-red-400",
  wait: "bg-amber-400",
  error: "bg-zinc-400",
};
const TONE_ICON: Record<Tone, string> = { good: "✓", bad: "✕", wait: "!", error: "!" };

/** A short beep (and buzz on phones): one high note to admit, two low notes otherwise. */
function signal(tone: Tone) {
  try {
    navigator.vibrate?.(tone === "good" ? 80 : [120, 60, 120]);
  } catch {}
  try {
    const ctx = new AudioContext();
    const notes = tone === "good" ? [{ f: 880, at: 0 }] : [{ f: 220, at: 0 }, { f: 220, at: 0.22 }];
    for (const { f, at } of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = f;
      osc.type = tone === "good" ? "sine" : "square";
      gain.gain.setValueAtTime(0.15, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.17);
    }
    setTimeout(() => void ctx.close(), 800);
  } catch {
    // No audio (e.g. autoplay blocked before the first tap): the screen still shows the result
  }
}

interface HistoryItem {
  id: number;
  at: string;
  outcome: Outcome;
  detail: string;
}

export default function ScannerClient() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sound, setSound] = useState(true);
  const lastScan = useRef<{ text: string; at: number } | null>(null);
  const historyId = useRef(0);

  async function verify(code: string) {
    setBusy(true);
    let next: ScanResult;
    try {
      const res = await fetch("/api/admin/verify-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      next = data.outcome ? data : { outcome: "ERROR", message: data.error ?? "The server could not check this ticket." };
    } catch {
      next = { outcome: "ERROR", message: "Network error." };
    }
    setBusy(false);
    setResult(next);
    if (sound) signal(OUTCOMES[next.outcome].tone);
    const t = "ticket" in next ? next.ticket : undefined;
    setHistory((h) =>
      [
        {
          id: ++historyId.current,
          at: new Date().toISOString(),
          outcome: next.outcome,
          detail: t ? `${"seat" in next && next.seat ? `${next.seat} · ` : ""}${t.bookingReference}` : "",
        },
        ...h,
      ].slice(0, 8)
    );
  }

  function handleScan(text: string) {
    const now = Date.now();
    const last = lastScan.current;
    if (busy || result) return; // one ticket at a time
    if (last && last.text === text && now - last.at < DUPLICATE_WINDOW_MS) return; // same QR, same second
    lastScan.current = { text, at: now };
    verify(text);
  }

  function handleManual(e: React.FormEvent) {
    e.preventDefault();
    if (manualCode.trim() && !busy) verify(manualCode.trim());
  }

  function scanNext() {
    setResult(null);
    setManualCode("");
  }

  const ticket = result && "ticket" in result ? result.ticket : undefined;
  const seat = result && "seat" in result ? result.seat : undefined;
  const usedInBooking = ticket ? ticket.seats.filter((s) => s.status === "USED").length : 0;
  const otherSeats = ticket ? ticket.seats.filter((s) => s.label !== seat) : [];
  const info = result ? OUTCOMES[result.outcome] : null;
  const admitted = result?.outcome === "ADMITTED";

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black text-white">Ticket Scanner</h1>
          <button
            type="button"
            onClick={() => setSound((s) => !s)}
            aria-pressed={sound}
            className="min-h-11 rounded-xl border border-white/15 px-3 text-xs font-semibold text-zinc-300 hover:bg-white/[0.06]"
          >
            {sound ? "🔊 Sound on" : "🔇 Sound off"}
          </button>
        </div>

        {/* The result covers the camera (paused meanwhile), so it is in view without scrolling on a phone */}
        <div className={`relative ${busy || result ? "min-h-[27rem]" : ""}`}>
          <QrScanner onScan={handleScan} paused={busy || result !== null} />

          {busy && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/70 text-lg font-bold text-white">
              Checking…
            </div>
          )}

          {result && info && (
            <div
              role="status"
              className={`absolute inset-0 z-10 flex flex-col overflow-y-auto rounded-2xl border-2 p-5 ${TONE_CARD[info.tone]}`}
            >
              {admitted && ticket ? (
                <>
                  <p className="text-4xl font-black tracking-tight sm:text-5xl">✓ ADMIT 1</p>
                  <p className="mt-1 font-mono text-2xl font-bold sm:text-3xl">Seat {seat}</p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-black">
                    {TONE_ICON[info.tone]} {info.title}
                  </p>
                  <p className="mt-1 opacity-90">{result.message}</p>
                  {"usedAt" in result && result.usedAt && result.outcome === "ALREADY_USED" && (
                    <p className="mt-1 font-semibold">Used at {formatCinemaDateTime(result.usedAt)}</p>
                  )}
                </>
              )}

              <p className="mt-3 font-semibold">{info.next}</p>

              {ticket && (
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="opacity-70">Movie</dt>
                  <dd className="font-semibold">{ticket.movie.title}</dd>
                  <dt className="opacity-70">Theatre</dt>
                  <dd>
                    {ticket.showtime.screenName} · {ticket.showtime.screenFormat}
                  </dd>
                  <dt className="opacity-70">Starts</dt>
                  <dd>{formatCinemaTime(ticket.showtime.startsAt)}</dd>
                  {!admitted && seat && (
                    <>
                      <dt className="opacity-70">Seat</dt>
                      <dd className="font-mono font-semibold">{seat}</dd>
                    </>
                  )}
                  <dt className="opacity-70">Booking</dt>
                  <dd>
                    {usedInBooking} of {ticket.seats.length} admitted
                    {otherSeats.length > 0 && (
                      <span className="opacity-80">
                        {" "}· other seats:{" "}
                        {otherSeats.map((s) => `${s.label}${s.status === "USED" ? " ✓" : ""}`).join(", ")}
                      </span>
                    )}
                  </dd>
                  <dt className="opacity-70">Reference</dt>
                  <dd className="font-mono">{ticket.bookingReference}</dd>
                </dl>
              )}

              {/* Result stays until staff move on: an auto-clearing result is easy to miss in a queue */}
              <div className="min-h-5 flex-1" aria-hidden /> {/* pushes the button to the bottom */}
              <button
                type="button"
                autoFocus
                onClick={scanNext}
                className="min-h-12 w-full shrink-0 rounded-xl bg-white/90 py-3 font-bold text-black hover:bg-white"
              >
                Scan next ticket
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0 space-y-4 lg:pt-14">
        {/* Manual fallback: same endpoint, same parseQrPayload() rules */}
        <form onSubmit={handleManual} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <label htmlFor="manual-code" className="text-sm font-bold text-white">
            Enter a code instead
          </label>
          <p className="mt-0.5 text-xs text-zinc-400">
            QR not scanning? On the customer&apos;s ticket, tap &quot;Show manual entry code&quot; under the QR.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              id="manual-code"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Ticket code"
              autoComplete="off"
              spellCheck={false}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/40 px-3 font-mono text-sm text-white"
            />
            <button
              type="submit"
              disabled={busy || !manualCode.trim()}
              className="btn-cobalt min-h-11 rounded-xl px-5 text-sm font-bold disabled:opacity-50"
            >
              Verify
            </button>
          </div>
        </form>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Recent scans</h2>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">Scans from this session appear here.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {history.map((h) => {
                const o = OUTCOMES[h.outcome];
                return (
                  <li key={h.id} className="flex items-center gap-2 text-zinc-200">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[o.tone]}`} aria-hidden />
                    <span className="font-semibold">{o.label}</span>
                    {h.detail && <span className="truncate font-mono text-xs text-zinc-400">{h.detail}</span>}
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-zinc-500">
                      {formatCinemaTime(h.at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
