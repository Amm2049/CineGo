"use client";

import { useRef, useState } from "react";
import QrScanner from "@/components/admin/QrScanner";
import type { VerifyTicketResult } from "@/services/ticket.service";
import { formatCinemaDateTime, formatCinemaTime } from "@/lib/schedule";

type ScanResult = VerifyTicketResult | { outcome: "ERROR"; message: string };
type Outcome = ScanResult["outcome"];

const DUPLICATE_WINDOW_MS = 4000; // the camera sees the same QR ~10 times per second

const STYLE: Record<Outcome, string> = {
  ADMITTED: "border-emerald-500 bg-emerald-500/15 text-emerald-100",
  ALREADY_USED: "border-red-500 bg-red-500/15 text-red-100",
  NOT_FOUND: "border-red-500 bg-red-500/15 text-red-100",
  INVALID_CODE: "border-red-500 bg-red-500/15 text-red-100",
  TOO_EARLY: "border-amber-500 bg-amber-500/15 text-amber-100",
  SHOW_ENDED: "border-amber-500 bg-amber-500/15 text-amber-100",
  ERROR: "border-zinc-500 bg-zinc-500/15 text-zinc-100",
};

const TITLE: Record<Outcome, string> = {
  ADMITTED: "✓ Admit",
  ALREADY_USED: "✕ Already used",
  NOT_FOUND: "✕ Unknown ticket",
  INVALID_CODE: "✕ Not a CineGo ticket",
  TOO_EARLY: "! Too early",
  SHOW_ENDED: "! Show has ended",
  ERROR: "! Could not verify",
};

interface HistoryItem {
  at: string;
  outcome: Outcome;
  label: string;
}

export default function ScannerClient() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const lastScan = useRef<{ text: string; at: number } | null>(null);

  async function verify(code: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/verify-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      const next: ScanResult = data.outcome
        ? data
        : { outcome: "ERROR", message: data.error ?? "Failed" };
      setResult(next);
      setHistory((h) =>
        [
          {
            at: new Date().toISOString(),
            outcome: next.outcome,
            label: "ticket" in next && next.ticket ? next.ticket.bookingReference : code.slice(0, 18),
          },
          ...h,
        ].slice(0, 8)
      );
    } catch {
      setResult({ outcome: "ERROR", message: "Network error. Try again or enter the code manually." });
    } finally {
      setBusy(false);
    }
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

  const ticket = result && "ticket" in result ? result.ticket : undefined;

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <h1 className="text-3xl font-black text-white">Ticket Scanner</h1>
        <QrScanner onScan={handleScan} paused={busy || result !== null} />

        {/* Manual fallback: same endpoint, same parseQrPayload() rules */}
        <form onSubmit={handleManual} className="flex gap-2">
          <label htmlFor="manual-code" className="sr-only">
            Ticket code
          </label>
          <input
            id="manual-code"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="QR not scanning? Paste the ticket code"
            className="flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-white"
          />
          <button type="submit" disabled={busy || !manualCode.trim()}
            className="btn-cobalt rounded-xl px-4 text-sm font-bold disabled:opacity-50">
            Verify
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {busy && <p className="text-sm text-zinc-400">Checking…</p>}

        {result && (
          <div className={`rounded-2xl border-2 p-5 ${STYLE[result.outcome]}`} role="status">
            <p className="text-2xl font-black">{TITLE[result.outcome]}</p>
            <p className="mt-1">{result.message}</p>
            {"usedAt" in result && result.usedAt && result.outcome === "ALREADY_USED" && (
              <p className="mt-1 font-semibold">Used at {formatCinemaDateTime(result.usedAt)}</p>
            )}
            {ticket && (
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="opacity-70">Movie</dt>
                <dd className="font-semibold">{ticket.movie.title}</dd>
                <dt className="opacity-70">Theatre</dt>
                <dd>{ticket.showtime.screenName} · {ticket.showtime.screenFormat}</dd>
                <dt className="opacity-70">Starts</dt>
                <dd>{formatCinemaTime(ticket.showtime.startsAt)}</dd>
                <dt className="opacity-70">Seats</dt>
                <dd>{ticket.seats.map((s) => s.label).join(", ")}</dd>
                <dt className="opacity-70">Reference</dt>
                <dd className="font-mono">{ticket.bookingReference}</dd>
              </dl>
            )}
            {/* Result stays until staff move on: an auto-clearing result is easy to miss in a queue */}
            <button
              type="button"
              autoFocus
              onClick={() => {
                setResult(null);
                setManualCode("");
              }}
              className="mt-5 w-full rounded-xl bg-white/90 py-2.5 font-bold text-black"
            >
              Scan next ticket
            </button>
          </div>
        )}

        {history.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Recent scans</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {history.map((h) => (
                <li key={h.at} className="flex justify-between gap-3 text-zinc-200">
                  <span className="font-mono">{h.label}</span>
                  <span className="text-zinc-400">
                    {h.outcome} · {formatCinemaTime(h.at)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
