"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
// Values only from the pure schedule helpers; only a *type* from the service
import type { AdminShowtimeRow } from "@/services/showtime.service";
import {
  CLEANING_BUFFER_MINUTES,
  addCinemaDays,
  cinemaLocalToDate,
  computeEndsAt,
  formatCinemaDate,
  formatCinemaTime,
  nextFreeStart,
  rangesOverlap,
  todayInCinemaTz,
} from "@/lib/schedule";
import { useToasts, ToastStack } from "@/components/admin/Toasts";

interface Props {
  day: string; // "YYYY-MM-DD", the one date shared by the form and the schedule
  nowIso: string;
  movies: { id: string; title: string; duration: number }[];
  screens: { id: string; name: string; format: string }[];
  showtimes: AdminShowtimeRow[];
}

const OPENING_TIME = "10:00"; // the earliest default start (the seed's first shows are at 11:00)
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

export default function AdminShowtimesClient({ day, nowIso, movies, screens, showtimes }: Props) {
  const router = useRouter();
  const { toasts, push } = useToasts();
  const now = new Date(nowIso);
  const today = todayInCinemaTz(now);
  const pastDay = day < today;

  const [movieId, setMovieId] = useState(movies[0]?.id ?? "");
  const [screenId, setScreenId] = useState(screens[0]?.id ?? "");
  // null = use the suggested free time; set once the admin picks a time themselves
  const [chosenTime, setChosenTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Which theatre the schedule shows: "all", or one theatre id (follows the form's Theatre select)
  const [theatreFilter, setTheatreFilter] = useState<string>("all");

  // Moving to another day drops a hand-picked time (React's "adjust state while rendering" pattern)
  const [timeForDay, setTimeForDay] = useState(day);
  if (timeForDay !== day) {
    setTimeForDay(day);
    setChosenTime(null);
  }

  const movie = movies.find((m) => m.id === movieId);
  const screen = screens.find((s) => s.id === screenId);
  const busy = showtimes.filter((s) => s.screenId === screenId);

  // Suggested start: the first free 5-minute mark from opening time (or from now, today)
  const opening = cinemaLocalToDate(`${day}T${OPENING_TIME}`);
  const suggested = movie
    ? nextFreeStart({
        day,
        durationMinutes: movie.duration,
        busy,
        from: now > opening ? new Date(now.getTime() + 5 * 60_000) : opening,
      })
    : null;
  const time = chosenTime ?? (suggested ? formatCinemaTime(suggested) : "");
  const [hour, minute] = time ? time.split(":") : ["", ""];

  // Preview, derived on every render (never stored in state)
  const startsAt = time ? cinemaLocalToDate(`${day}T${time}`) : null;
  const endsAt = movie && startsAt ? computeEndsAt(startsAt, movie.duration) : null;
  const clash =
    startsAt && endsAt
      ? busy.find((s) => rangesOverlap(startsAt, endsAt, new Date(s.startsAt), new Date(s.endsAt)))
      : undefined;
  const inPast = startsAt !== null && startsAt <= now;
  // The next time that fits after the clash, for the "Use next free time" button
  const nextAfterClash =
    clash && movie && startsAt ? nextFreeStart({ day, durationMinutes: movie.duration, busy, from: startsAt }) : null;

  let problem: string | null = null;
  if (pastDay) problem = "This day is over. Pick today or a later date.";
  else if (!time) problem = `${screen?.name ?? "This theatre"} has no free time left on this day.`;
  else if (inPast) problem = "That time has already passed.";
  else if (clash)
    problem = `Clashes with ${clash.movieTitle} (${formatCinemaTime(clash.startsAt)}–${formatCinemaTime(clash.endsAt)}) in ${screen?.name}. Shows need ${CLEANING_BUFFER_MINUTES} min between them for cleaning.`;

  function goToDay(next: string) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(next) && next !== day) router.push(`/admin/showtimes?date=${next}`);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!startsAt || problem) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/showtimes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send an unambiguous UTC instant, never a local date-time string
        body: JSON.stringify({ movieId, screenId, startsAt: startsAt.toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) {
        push("error", data.error ?? "Could not create showtime");
        return;
      }
      push("success", `Scheduled ${movie?.title} at ${formatCinemaTime(startsAt)} in ${screen?.name}`);
      setChosenTime(null); // suggest the next free time again
      router.refresh();
    } catch {
      push("error", "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: AdminShowtimeRow) {
    if (!confirm(`Delete ${row.movieTitle} at ${formatCinemaTime(row.startsAt)} in ${row.screenName}?`)) return;
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

  const inputCls = "w-full min-w-0 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white";
  const labelCls = "block text-xs font-semibold uppercase tracking-wider text-zinc-400";
  const navBtn =
    "flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/15 px-3 text-sm font-semibold text-zinc-200 hover:bg-white/[0.06] sm:min-h-9 sm:min-w-9";

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <form
        onSubmit={handleCreate}
        className="h-fit min-w-0 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
      >
        <h1 className="text-xl font-black text-white">Add showtime</h1>

        <label className={labelCls}>
          Date
          <input
            type="date"
            value={day}
            min={today}
            onChange={(e) => goToDay(e.target.value)}
            className={`mt-1 ${inputCls}`}
          />
          <span className="mt-1 block text-[11px] normal-case tracking-normal text-zinc-500">
            {formatCinemaDate(day)} · the schedule below shows this day
          </span>
        </label>

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
          Theatre
          <select
            value={screenId}
            onChange={(e) => {
              setScreenId(e.target.value);
              setTheatreFilter(e.target.value); // show that theatre's day while picking a time
            }}
            className={`mt-1 ${inputCls}`}
          >
            {screens.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.format}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className={labelCls}>Start time</legend>
          <div className="mt-1 flex items-center gap-2">
            <select
              aria-label="Hour"
              value={hour}
              onChange={(e) => setChosenTime(`${e.target.value}:${minute || "00"}`)}
              className={`${inputCls} font-mono`}
            >
              {!hour && <option value="">--</option>}
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="font-mono text-zinc-400">:</span>
            <select
              aria-label="Minute"
              value={minute}
              onChange={(e) => setChosenTime(`${hour || "00"}:${e.target.value}`)}
              className={`${inputCls} font-mono`}
            >
              {!minute && <option value="">--</option>}
              {MINUTES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">24-hour clock, Bangkok time (e.g. 19:30 = 7:30 pm)</p>
        </fieldset>

        {endsAt && !problem && (
          <p className="text-sm text-zinc-300">
            {formatCinemaTime(startsAt!)}–{formatCinemaTime(endsAt)} · {screen?.name} free again at{" "}
            {formatCinemaTime(new Date(endsAt.getTime() + CLEANING_BUFFER_MINUTES * 60_000))}
          </p>
        )}
        {problem && (
          <div role="alert" className="space-y-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <p>{problem}</p>
            {clash &&
              (nextAfterClash ? (
                <button
                  type="button"
                  onClick={() => setChosenTime(formatCinemaTime(nextAfterClash))}
                  className="min-h-9 rounded-lg border border-red-300/40 px-3 text-xs font-bold text-white hover:bg-red-500/20"
                >
                  Use next free time ({formatCinemaTime(nextAfterClash)})
                </button>
              ) : (
                <p className="text-xs text-red-300">Nothing fits later on this day in {screen?.name}.</p>
              ))}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !movieId || !screenId || problem !== null}
          className="btn-cobalt min-h-11 w-full rounded-xl py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : "Create showtime"}
        </button>
      </form>

      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white">Schedule</h2>
            <p className="text-sm text-zinc-400">
              {day === today ? "Today · " : ""}
              {formatCinemaDate(day)}
            </p>
          </div>
          <nav aria-label="Change day" className="flex items-center gap-2">
            <Link href={`/admin/showtimes?date=${addCinemaDays(day, -1)}`} aria-label="Previous day" className={navBtn}>
              ‹
            </Link>
            {day === today ? (
              <span className={`${navBtn} cursor-default opacity-40`} aria-disabled="true">
                Today
              </span>
            ) : (
              <Link href={`/admin/showtimes?date=${today}`} className={navBtn}>
                Today
              </Link>
            )}
            <Link href={`/admin/showtimes?date=${addCinemaDays(day, 1)}`} aria-label="Next day" className={navBtn}>
              ›
            </Link>
          </nav>
        </div>

        {/* Theatre filter: on a phone, one theatre's day instead of all four stacked */}
        <div role="group" aria-label="Show theatre" className="flex flex-wrap gap-2">
          {[{ id: "all", label: "All" }, ...screens.map((s) => ({ id: s.id, label: s.name }))].map((chip) => {
            const selected = theatreFilter === chip.id;
            const count = chip.id === "all" ? showtimes.length : showtimes.filter((s) => s.screenId === chip.id).length;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setTheatreFilter(chip.id)}
                className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors sm:min-h-9 ${
                  selected
                    ? "border-[#5938ff] bg-[#2500f0] text-white"
                    : "border-white/15 text-zinc-300 hover:border-[#5938ff]/70 hover:bg-white/[0.04]"
                }`}
              >
                {chip.label}
                <span className={`ml-1.5 text-xs ${selected ? "text-white/75" : "text-zinc-500"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {screens.filter((t) => theatreFilter === "all" || t.id === theatreFilter).map((theatre) => {
          const rows = showtimes.filter((s) => s.screenId === theatre.id);
          return (
            <div key={theatre.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="font-bold text-white">
                {theatre.name} <span className="ml-1 text-xs font-semibold text-[#c7d2fe]">{theatre.format}</span>
              </h3>
              {rows.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">Nothing scheduled.</p>
              ) : (
                <ul className="mt-2 divide-y divide-white/5">
                  {rows.map((row) => {
                    const start = new Date(row.startsAt);
                    const end = new Date(row.endsAt);
                    const ended = end <= now;
                    const playing = start <= now && now < end;
                    const pct = row.capacity > 0 ? Math.round((row.seatsSold / row.capacity) * 100) : 0;
                    return (
                      <li
                        key={row.id}
                        className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm ${ended ? "opacity-45" : ""}`}
                      >
                        <span className="w-28 shrink-0 font-mono text-zinc-200">
                          {formatCinemaTime(row.startsAt)}–{formatCinemaTime(row.endsAt)}
                        </span>
                        <span className="min-w-0 flex-1 basis-32 truncate text-white">
                          {row.movieTitle}
                          {playing && (
                            <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                              Now playing
                            </span>
                          )}
                          {ended && <span className="ml-2 text-[11px] text-zinc-500">Ended</span>}
                        </span>
                        <span className="flex w-28 shrink-0 flex-col gap-1 text-xs text-zinc-400">
                          <span className="tabular-nums">
                            {row.seatsSold} / {row.capacity} sold
                          </span>
                          <span className="h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
                            <span className="block h-full rounded-full bg-[#5938ff]" style={{ width: `${pct}%` }} />
                          </span>
                        </span>
                        <span className="ml-auto flex w-24 shrink-0 justify-end">
                          {row.hasBookings ? (
                            <span className="text-xs text-zinc-500">Has bookings</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              aria-label={`Delete ${row.movieTitle} at ${formatCinemaTime(row.startsAt)}`}
                              className="min-h-11 rounded-lg px-3 text-xs text-zinc-400 hover:bg-red-500/10 hover:text-red-300 sm:min-h-8"
                            >
                              Delete
                            </button>
                          )}
                        </span>
                      </li>
                    );
                  })}
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
