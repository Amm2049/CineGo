"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// Values only from the pure schedule helpers; only a *type* from the service
import type { AdminShowtimeRow } from "@/services/showtime.service";
import {
  CLEANING_BUFFER_MINUTES,
  cinemaLocalToDate,
  computeEndsAt,
  formatCinemaTime,
  rangesOverlap,
} from "@/lib/schedule";
import { useToasts, ToastStack } from "@/components/admin/Toasts";

interface Props {
  day: string;
  movies: { id: string; title: string; duration: number }[];
  screens: { id: string; name: string; format: string }[];
  showtimes: AdminShowtimeRow[];
}

export default function AdminShowtimesClient({ day, movies, screens, showtimes }: Props) {
  const router = useRouter();
  const { toasts, push } = useToasts();
  const [movieId, setMovieId] = useState(movies[0]?.id ?? "");
  const [screenId, setScreenId] = useState(screens[0]?.id ?? "");
  const [startLocal, setStartLocal] = useState(`${day}T19:00`);
  const [saving, setSaving] = useState(false);

  // Preview, derived on every render (never stored in state)
  const movie = movies.find((m) => m.id === movieId);
  const startsAt = startLocal ? cinemaLocalToDate(startLocal) : null;
  const validStart = startsAt !== null && !Number.isNaN(startsAt.getTime());
  const endsAt = movie && startsAt && validStart ? computeEndsAt(startsAt, movie.duration) : null;
  // UX-only pre-check against the day on screen; the server's transaction is the real rule
  const clash =
    startsAt && validStart && endsAt
      ? showtimes.find(
          (s) =>
            s.screenId === screenId &&
            rangesOverlap(startsAt, endsAt, new Date(s.startsAt), new Date(s.endsAt))
        )
      : undefined;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!startsAt || !validStart) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/showtimes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send an unambiguous UTC instant, never the raw datetime-local string
        body: JSON.stringify({ movieId, screenId, startsAt: startsAt.toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) {
        push("error", data.error ?? "Could not create showtime");
        return;
      }
      push("success", `Scheduled ${movie?.title} at ${formatCinemaTime(startsAt)}`);
      const newDay = startLocal.slice(0, 10);
      if (newDay !== day) router.push(`/admin/showtimes?date=${newDay}`);
      else router.refresh();
    } catch {
      push("error", "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: AdminShowtimeRow) {
    if (!confirm(`Delete ${row.movieTitle} at ${formatCinemaTime(row.startsAt)}?`)) return;
    try {
      const res = await fetch(`/api/admin/showtimes/${row.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        push("error", data.error ?? "Delete failed");
        return;
      }
      push("success", "Showtime deleted");
      router.refresh();
    } catch {
      push("error", "Network error");
    }
  }

  const inputCls = "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white";
  const labelCls = "block text-xs font-semibold uppercase tracking-wider text-zinc-400";

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form onSubmit={handleCreate} className="h-fit space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h1 className="text-xl font-black text-white">Add showtime</h1>

        <label className={labelCls}>
          Movie
          <select value={movieId} onChange={(e) => setMovieId(e.target.value)} className={`mt-1 ${inputCls}`}>
            {movies.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} ({m.duration} min)
              </option>
            ))}
          </select>
        </label>

        <label className={labelCls}>
          Screen
          <select value={screenId} onChange={(e) => setScreenId(e.target.value)} className={`mt-1 ${inputCls}`}>
            {screens.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.format}
              </option>
            ))}
          </select>
        </label>

        <label className={labelCls}>
          Starts (Bangkok time)
          <input
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            className={`mt-1 ${inputCls}`}
          />
        </label>

        {endsAt && (
          <p className="text-sm text-zinc-300">
            Ends {formatCinemaTime(endsAt)} · screen free again at{" "}
            {formatCinemaTime(new Date(endsAt.getTime() + CLEANING_BUFFER_MINUTES * 60_000))}
          </p>
        )}
        {clash && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Clashes with {clash.movieTitle} ({formatCinemaTime(clash.startsAt)}–{formatCinemaTime(clash.endsAt)}).
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !movieId || !screenId || !validStart}
          className="btn-cobalt w-full rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Create showtime"}
        </button>
      </form>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black text-white">Schedule</h2>
          <input
            type="date"
            aria-label="Schedule date"
            value={day}
            onChange={(e) => e.target.value && router.push(`/admin/showtimes?date=${e.target.value}`)}
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
          />
        </div>

        {screens.map((screen) => {
          const rows = showtimes.filter((s) => s.screenId === screen.id);
          return (
            <div key={screen.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="font-bold text-white">
                {screen.name} <span className="ml-1 text-xs font-semibold text-[#c7d2fe]">{screen.format}</span>
              </h3>
              {rows.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">Nothing scheduled.</p>
              ) : (
                <ul className="mt-2 divide-y divide-white/5">
                  {rows.map((row) => (
                    <li key={row.id} className="flex items-center gap-3 py-2 text-sm">
                      <span className="w-28 shrink-0 font-mono text-zinc-200">
                        {formatCinemaTime(row.startsAt)}–{formatCinemaTime(row.endsAt)}
                      </span>
                      <span className="flex-1 truncate text-white">{row.movieTitle}</span>
                      <span className="text-xs text-zinc-400">{row.seatsSold} sold</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        disabled={row.hasBookings}
                        title={row.hasBookings ? "Has bookings" : "Delete"}
                        className="rounded-lg px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-30"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <ToastStack toasts={toasts} />
    </div>
  );
}
