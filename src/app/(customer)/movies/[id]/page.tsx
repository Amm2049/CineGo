// src/app/(customer)/movies/[id]/page.tsx
// Movie page with the showtime picker: date strip → times grouped by theatre → /checkout/<showtimeId>.
// "Watch trailer" appears when the movie has a trailerKey (YouTube id from the TMDB sync).
// Phase 10: before this page, a movie card opened one arbitrary showtime and customers could not
// choose the date, time or theatre.

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isCustomer } from "@/lib/roles";
import { formatCinemaDayLabel, formatCinemaTime } from "@/lib/schedule";
import { formatDuration } from "@/lib/utils";
import TrailerButton from "@/components/movies/TrailerButton";
import {
  getMovieWithShowtimes,
  type MovieShowtimeOption,
} from "@/services/movie.service";

export const dynamic = "force-dynamic";

const FEW_SEATS_LEFT = 10;

export default async function MoviePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const [{ id }, { date }] = await Promise.all([params, searchParams]);
  const [data, session] = await Promise.all([
    getMovieWithShowtimes(id),
    getServerSession(authOptions),
  ]);
  if (!data) notFound(); // unknown or hidden movie

  const { movie, showtimes } = data;
  const now = new Date();
  const days = Array.from(new Set(showtimes.map((s) => s.day)));
  const selectedDay = date && days.includes(date) ? date : days[0];
  const dayShows = showtimes.filter((s) => s.day === selectedDay);

  // One block per theatre, in theatre order; times inside are already earliest-first
  const theatres = new Map<
    number,
    { name: string; format: string; shows: MovieShowtimeOption[] }
  >();
  for (const show of dayShows) {
    const group = theatres.get(show.screenNumber) ?? {
      name: show.screenName,
      format: show.screenFormat,
      shows: [],
    };
    group.shows.push(show);
    theatres.set(show.screenNumber, group);
  }

  const theatreGroups = Array.from(theatres.entries())
    .sort(([a], [b]) => a - b)
    .map(([, g]) => g);

  const released = new Date(movie.releaseDate) <= now;
  const opensLabel = new Date(movie.releaseDate).toLocaleDateString("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "long",
  });
  const signedInNonCustomer =
    Boolean(session?.user) && !isCustomer(session?.user?.role);

  return (
    <main className="w-full min-w-0 flex-1 bg-[#03030d] text-white">
      {/* Hero: backdrop + poster + title. Tall enough (scales with screen width) to show most of the
          16:9 backdrop; the poster and title sit at the bottom of it. */}
      <section className="relative flex min-h-[max(360px,min(34vw,70svh))] flex-col overflow-hidden border-b border-white/10">
        <Image
          src={movie.backdropUrl || movie.posterUrl}
          alt=""
          fill
          sizes="100vw"
          loading="eager"
          fetchPriority="high"
          className="object-cover object-[center_25%] opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#03030d] via-[#03030d]/55 to-[#03030d]/20" />

        <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-8 pt-8 sm:px-6 lg:px-8">
          <Link
            href="/movies"
            className="self-start text-sm font-semibold text-[#c7d2fe] hover:text-white"
          >
            ← All movies
          </Link>
          <div className="mt-auto flex items-end gap-4 pt-6 sm:gap-6">
            <div className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-2xl border border-white/15 shadow-2xl sm:w-40">
              <Image
                src={movie.posterUrl}
                alt=""
                fill
                sizes="(max-width: 640px) 96px, 160px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0 pb-1">
              <h1 className="text-2xl font-black leading-tight sm:text-4xl">
                {movie.title}
              </h1>
              <p className="mt-2 text-sm text-zinc-300">
                {[
                  formatDuration(movie.duration),
                  movie.genres.slice(0, 3).join(" / "),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p
                className={`mt-1 text-sm font-bold ${released ? "text-emerald-400" : "text-amber-300"}`}
              >
                {released ? "Now showing" : `Opens ${opensLabel}`}
              </p>
              {movie.trailerKey && (
                <TrailerButton
                  trailerKey={movie.trailerKey}
                  title={movie.title}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {movie.description && (
          <p className="max-w-3xl text-sm leading-relaxed text-zinc-300 sm:text-base">
            {movie.description}
          </p>
        )}

        <section aria-labelledby="showtimes-heading" className="space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="showtimes-heading" className="text-xl font-black">
              Showtimes
            </h2>
            <p className="text-xs text-zinc-500">All times are Bangkok time</p>
          </div>

          {signedInNonCustomer && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              You&apos;re signed in with a staff account. Booking is for
              customer accounts.
            </p>
          )}

          {days.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-zinc-300">
              {released
                ? "No upcoming showtimes for this movie right now."
                : `Opens ${opensLabel}. Showtimes appear here once they're scheduled.`}
            </div>
          ) : (
            <>
              {/* Date strip: one link per day that has shows */}
              <nav aria-label="Choose a date">
                <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
                  {days.map((day) => {
                    const selected = day === selectedDay;
                    const count = showtimes.filter((s) => s.day === day).length;
                    return (
                      <li key={day} className="shrink-0">
                        <Link
                          href={`/movies/${movie.id}?date=${day}`}
                          scroll={false}
                          replace
                          aria-current={selected ? "date" : undefined}
                          className={`flex min-h-11 flex-col justify-center rounded-xl border px-4 py-2 text-center transition-colors ${
                            selected
                              ? "border-[#5938ff] bg-[#2500f0] text-white"
                              : "border-white/15 text-zinc-200 hover:border-[#5938ff]/70 hover:bg-white/[0.04]"
                          }`}
                        >
                          <span className="text-sm font-bold">
                            {formatCinemaDayLabel(day, now)}
                          </span>
                          <span
                            className={`text-[11px] ${selected ? "text-white/80" : "text-zinc-500"}`}
                          >
                            {count} {count === 1 ? "show" : "shows"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* Times for the chosen day, one block per theatre */}
              <div className="grid gap-4 md:grid-cols-2">
                {theatreGroups.map((theatre) => (
                  <div
                    key={theatre.name}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <h3 className="font-bold">
                      {theatre.name}{" "}
                      <span className="ml-1 text-xs font-semibold text-[#c7d2fe]">
                        {theatre.format}
                      </span>
                    </h3>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {theatre.shows.map((show) => {
                        const time = formatCinemaTime(show.startsAt);
                        const soldOut = show.seatsLeft === 0;
                        const few =
                          !soldOut && show.seatsLeft <= FEW_SEATS_LEFT;
                        const detail = soldOut
                          ? "Sold out"
                          : `${show.seatsLeft} left`;
                        const body = (
                          <>
                            <span className="text-base font-black tabular-nums">
                              {time}
                            </span>
                            <span
                              className={`text-[11px] ${soldOut ? "text-zinc-500" : few ? "text-amber-300" : "text-zinc-400"}`}
                            >
                              {detail}
                            </span>
                          </>
                        );
                        return (
                          <li key={show.id}>
                            {soldOut ? (
                              <span
                                aria-disabled="true"
                                className="flex min-h-11 min-w-20 flex-col items-center justify-center rounded-xl border border-white/10 px-4 py-1.5 text-zinc-500 line-through decoration-zinc-600"
                              >
                                {body}
                              </span>
                            ) : (
                              <Link
                                href={`/checkout/${show.id}`}
                                prefetch={false}
                                aria-label={`${time}, ${theatre.name} ${theatre.format}, ${detail}`}
                                className="flex min-h-11 min-w-20 flex-col items-center justify-center rounded-xl border border-white/15 px-4 py-1.5 transition-colors hover:border-[#5938ff] hover:bg-[#2500f0]/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5938ff]"
                              >
                                {body}
                              </Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
