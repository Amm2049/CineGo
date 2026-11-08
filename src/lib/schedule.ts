// src/lib/schedule.ts
// Pure scheduling + time-zone helpers. No Prisma import, so client components may use it.

export const CINEMA_TIME_ZONE = "Asia/Bangkok";
export const CINEMA_UTC_OFFSET = "+07:00"; // Thailand has no daylight saving time
export const CLEANING_BUFFER_MINUTES = 25; // same buffer prisma/seed.ts uses

const MINUTE_MS = 60_000;

export function computeEndsAt(startsAt: Date, durationMinutes: number): Date {
  return new Date(startsAt.getTime() + durationMinutes * MINUTE_MS);
}

/**
 * Do two screenings clash on the same screen?
 * Each screening occupies [start, end + buffer). Touching edges do not clash.
 */
export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
  bufferMinutes: number = CLEANING_BUFFER_MINUTES
): boolean {
  const buffer = bufferMinutes * MINUTE_MS;
  return aStart.getTime() < bEnd.getTime() + buffer && bStart.getTime() < aEnd.getTime() + buffer;
}

/** "2026-11-05T19:30" from a datetime-local input, read as Bangkok time (not the machine's zone). */
export function cinemaLocalToDate(local: string): Date {
  return new Date(`${local}:00${CINEMA_UTC_OFFSET}`);
}

/** Today's calendar date in Bangkok as "YYYY-MM-DD". */
export function todayInCinemaTz(now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: CINEMA_TIME_ZONE }).format(now);
}

/** The Bangkok calendar day a moment falls on, as "YYYY-MM-DD" (e.g. to group showtimes by day). */
export function cinemaDayOf(value: Date | string): string {
  return todayInCinemaTz(new Date(value));
}

/** Add whole days to a "YYYY-MM-DD" day (no time zone involved: pure calendar arithmetic). */
export function addCinemaDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Today", "Tomorrow" or "Mon 10 Nov" for a "YYYY-MM-DD" day, relative to Bangkok's today. */
export function formatCinemaDayLabel(day: string, now: Date = new Date()): string {
  const today = todayInCinemaTz(now);
  if (day === today) return "Today";
  if (day === addCinemaDays(today, 1)) return "Tomorrow";
  return formatCinemaDate(day);
}

/** "Sun 8 Nov" for a "YYYY-MM-DD" day. */
export function formatCinemaDate(day: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", // `day` is already a calendar date; noon UTC keeps it on that date
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${day}T12:00:00Z`));
}

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CINEMA_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CINEMA_TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** "19:30" in Bangkok time, wherever the code runs (Vercel is UTC). */
export function formatCinemaTime(value: Date | string): string {
  return timeFormatter.format(new Date(value));
}

/** "5 Nov, 19:30" in Bangkok time. */
export function formatCinemaDateTime(value: Date | string): string {
  return dateTimeFormatter.format(new Date(value));
}

const SLOT_MINUTES = 5;

/**
 * Earliest start on `day` (Bangkok) at or after `from`, on a 5-minute mark, where a movie of
 * `durationMinutes` fits around the screen's `busy` shows (with the cleaning buffer).
 * Returns null when nothing fits before midnight. UX only; the server transaction is the rule.
 */
export function nextFreeStart(params: {
  day: string;
  durationMinutes: number;
  busy: { startsAt: Date | string; endsAt: Date | string }[];
  from: Date;
}): Date | null {
  const slot = SLOT_MINUTES * MINUTE_MS;
  const roundUp = (t: number) => Math.ceil(t / slot) * slot;
  const shows = params.busy.map((b) => ({ start: new Date(b.startsAt), end: new Date(b.endsAt) }));
  // Candidates: the requested time, and the moment each show's cleaning buffer ends
  const candidates = [
    roundUp(params.from.getTime()),
    ...shows.map((s) => roundUp(s.end.getTime() + CLEANING_BUFFER_MINUTES * MINUTE_MS)),
  ]
    .filter((t) => t >= params.from.getTime())
    .sort((a, b) => a - b);

  for (const t of candidates) {
    const start = new Date(t);
    if (cinemaDayOf(start) !== params.day) continue; // must start on that day
    const end = computeEndsAt(start, params.durationMinutes);
    if (!shows.some((s) => rangesOverlap(start, end, s.start, s.end))) return start;
  }
  return null;
}

/** "19:30" → minutes after midnight, and back. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
export function minutesToHhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
