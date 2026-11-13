// src/services/movie-sync.service.ts
// CineGo — TMDB ingestion: shared by the weekly cron, the admin bulk sync and single imports.
// Import TMDB helpers from @/lib/tmdb only: movie.service.ts also has a getUpcomingMovies (DB query).

import prisma from "@/lib/prisma";
import { addCinemaDays, todayInCinemaTz } from "@/lib/schedule";
import {
  discoverUpcomingInThailand,
  getMovieDetails,
  getNowPlayingMovies,
  getTmdbImageUrl,
  hasTmdbCredentials,
  searchMovies,
  TMDB_REGION,
  type TmdbMovieDetails,
  type TmdbMovieSummary,
  type TmdbVideo,
} from "@/lib/tmdb";
import { isYouTubeEmbeddable } from "@/lib/youtube";

export const NOW_SHOWING_TARGET = 20;
export const UPCOMING_TARGET = 40;
/** How far ahead the upcoming list looks (Thai cinema release dates). */
export const UPCOMING_WINDOW_DAYS = 183; // ~6 months
/** The bulk sync keeps English-language films only (US, UK, ... still with their THAI release dates). */
export const SYNC_ORIGINAL_LANGUAGE = "en";
/** TMDB list pages to read per list while filling the targets (20 titles per page). */
export const MAX_SYNC_PAGES = 5;

type ListPage = { results: TmdbMovieSummary[]; total_pages: number };

/**
 * Take up to `target` English-language titles from a paged TMDB list, in TMDB's order, skipping ids
 * in `seen` (which it updates). Stops early when the list runs out; never pads with other languages.
 */
export async function collectEnglishTitles(
  fetchPage: (page: number) => Promise<ListPage>,
  target: number,
  seen: Set<number>
): Promise<number[]> {
  const ids: number[] = [];
  for (let page = 1; page <= MAX_SYNC_PAGES && ids.length < target; page++) {
    const { results, total_pages } = await fetchPage(page);
    for (const m of results) {
      if (ids.length >= target) break;
      if (m.original_language !== SYNC_ORIGINAL_LANGUAGE || seen.has(m.id)) continue;
      seen.add(m.id);
      ids.push(m.id);
    }
    if (page >= total_pages) break;
  }
  return ids;
}
const DETAIL_BATCH_SIZE = 5; // TMDB detail calls in flight at once
const UPSERT_BATCH_SIZE = 5; // database transactions in flight at once

export interface MovieSyncInput {
  tmdbId: number;
  title: string;
  description: string;
  duration: number;
  releaseDate: Date;
  posterUrl: string;
  backdropUrl: string;
  popularity: number;
  /** YouTube video id of the trailer, or null when TMDB has none. */
  trailerKey: string | null;
  genres: string[];
}

// ── 1. Pure mapping (unit tested) ──────────────────────────

export function normalizeGenreName(name: string): string {
  return name === "Science Fiction" ? "Sci-Fi" : name; // same rule as prisma/seed.ts
}

function parseTmdbDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// TMDB release types: 2 = theatrical (limited), 3 = theatrical
const THEATRICAL_TYPES = new Set([2, 3]);

/** Earliest cinema release in the given country, or null if TMDB has none. */
export function pickRegionalReleaseDate(
  details: TmdbMovieDetails,
  region: string = TMDB_REGION
): Date | null {
  const country = details.release_dates?.results.find((r) => r.iso_3166_1 === region);
  const dates = (country?.release_dates ?? [])
    .filter((d) => THEATRICAL_TYPES.has(d.type))
    .map((d) => parseTmdbDate(d.release_date))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  return dates[0] ?? null;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/; // the id goes into an embed URL, so accept only id characters

/**
 * The YouTube trailer to show on the movie page, or null if TMDB has none.
 * Prefers a Trailer over a Teaser, then an official video, then the newest one.
 */
export function pickTrailerKey(details: TmdbMovieDetails): string | null {
  return rankTrailers(details)[0]?.key ?? null;
}

/** YouTube trailers and teasers, best first. */
function rankTrailers(details: TmdbMovieDetails): TmdbVideo[] {
  const rank = (type: string) => (type === "Trailer" ? 0 : 1);
  return (details.videos?.results ?? [])
    .filter((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser") && YOUTUBE_ID.test(v.key))
    .sort(
      (a, b) =>
        rank(a.type) - rank(b.type) ||
        Number(b.official) - Number(a.official) ||
        (b.published_at ?? "").localeCompare(a.published_at ?? "")
    );
}

const MAX_TRAILER_CHECKS = 4; // YouTube lookups per movie at most

/**
 * Some trailer owners block playback on other websites. Keep only the best trailer that can play
 * inside our page (checked best-first), so pickTrailerKey() never returns a blocked one.
 * Returns a copy of `details`; a movie whose trailers are all blocked ends up with none.
 */
export async function withPlayableTrailer(
  details: TmdbMovieDetails,
  isEmbeddable: (key: string) => Promise<boolean> = isYouTubeEmbeddable
): Promise<TmdbMovieDetails> {
  for (const video of rankTrailers(details).slice(0, MAX_TRAILER_CHECKS)) {
    if (await isEmbeddable(video.key)) return { ...details, videos: { results: [video] } };
  }
  return { ...details, videos: { results: [] } };
}

/** Convert a TMDB details response into CineGo's Movie shape. No DB, no network. */
export function mapTmdbToMovieInput(
  details: TmdbMovieDetails,
  now: Date = new Date()
): MovieSyncInput {
  // Thai cinema date first, then TMDB's worldwide date. `now` only if TMDB has no date at all.
  const releaseDate =
    pickRegionalReleaseDate(details) ?? parseTmdbDate(details.release_date) ?? now;

  return {
    tmdbId: details.id,
    title: details.title,
    description: details.overview || details.tagline || "Synopsis coming soon.",
    duration: details.runtime && details.runtime > 0 ? details.runtime : 120,
    releaseDate,
    posterUrl: getTmdbImageUrl(details.poster_path, "w500"),
    backdropUrl: getTmdbImageUrl(details.backdrop_path, "original"),
    popularity: details.popularity ?? 0,
    trailerKey: pickTrailerKey(details),
    genres: Array.from(new Set(details.genres.map((g) => normalizeGenreName(g.name)))),
  };
}

// ── 2. Database writes ─────────────────────────────────────

/** Make sure every genre exists, then return a name -> id map. Two queries per sync. */
export async function resolveGenreIds(names: Iterable<string>): Promise<Map<string, string>> {
  const unique = Array.from(new Set(names));
  if (unique.length === 0) return new Map();

  await prisma.genre.createMany({
    data: unique.map((name) => ({ name })),
    skipDuplicates: true, // ON CONFLICT DO NOTHING on the unique genre name
  });
  const rows = await prisma.genre.findMany({
    where: { name: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((g) => [g.name, g.id]));
}

/**
 * Create the movie, or refresh it if this tmdbId is already imported.
 * Title, description and isActive are admin-owned and never overwritten.
 */
export async function upsertMovie(
  input: MovieSyncInput,
  genreIds: Map<string, string>
): Promise<string> {
  const { genres, ...data } = input;

  return prisma.$transaction(async (tx) => {
    // One INSERT ... ON CONFLICT ("tmdbId") DO UPDATE: no gap for a race to use
    const movie = await tx.movie.upsert({
      where: { tmdbId: data.tmdbId },
      create: data,
      update: {
        duration: data.duration,
        releaseDate: data.releaseDate,
        posterUrl: data.posterUrl,
        backdropUrl: data.backdropUrl,
        popularity: data.popularity, // TMDB-owned, changes daily
        trailerKey: data.trailerKey, // TMDB-owned; null when no trailer can play on our page
      },
      select: { id: true },
    });

    // Replace genre links so removed genres disappear too
    const links = genres
      .map((name) => genreIds.get(name))
      .filter((genreId): genreId is string => Boolean(genreId))
      .map((genreId) => ({ movieId: movie.id, genreId }));

    await tx.movieGenre.deleteMany({ where: { movieId: movie.id } });
    if (links.length > 0) {
      await tx.movieGenre.createMany({ data: links, skipDuplicates: true });
    }
    return movie.id;
  });
}

// ── 3. Single import, bulk sync, admin search ──────────────

export type UpsertOutcome = "created" | "updated";

export async function syncMovieByTmdbId(tmdbId: number) {
  const details = await withPlayableTrailer(await getMovieDetails(tmdbId));
  const input = mapTmdbToMovieInput(details);

  const [existing, genreIds] = await Promise.all([
    prisma.movie.findUnique({ where: { tmdbId }, select: { id: true } }),
    resolveGenreIds(input.genres),
  ]);
  const movieId = await upsertMovie(input, genreIds);
  const outcome: UpsertOutcome = existing ? "updated" : "created";
  return { movieId, outcome, title: input.title };
}

export interface SyncSummary {
  total: number;
  created: number;
  updated: number;
  failed: number;
  /** Upcoming candidates dropped because their Thai cinema date is not in the future (re-releases). */
  skipped: number;
  errors: string[];
  startedAt: string;
  finishedAt: string;
}

/** Run fn over items, at most `size` at a time; never throws (allSettled). */
async function settleInBatches<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.allSettled(items.slice(i, i + size).map(fn))));
  }
  return results;
}

function reasonOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/**
 * Fetch up to 20 now playing + 40 upcoming English-language titles in Thai cinemas and upsert them.
 * Upcoming uses TMDB Discover (Thai release in the next ~6 months), not the short /movie/upcoming list.
 */
export async function syncLatestReleases(): Promise<SyncSummary> {
  if (!hasTmdbCredentials()) {
    throw new Error("TMDB credentials are not configured");
  }
  const startedAt = new Date();

  // English-language titles only; a title in both lists is fetched once (shared `seen`)
  const seen = new Set<number>();
  const nowPlayingIds = await collectEnglishTitles(getNowPlayingMovies, NOW_SHOWING_TARGET, seen);
  const tomorrow = addCinemaDays(todayInCinemaTz(startedAt), 1);
  const upcomingWindow = { from: tomorrow, to: addCinemaDays(tomorrow, UPCOMING_WINDOW_DAYS) };
  const upcomingIds = await collectEnglishTitles(
    (page) => discoverUpcomingInThailand(page, upcomingWindow),
    UPCOMING_TARGET,
    seen
  );
  const ids = [...nowPlayingIds, ...upcomingIds];

  const summary: SyncSummary = {
    total: ids.length,
    created: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    startedAt: startedAt.toISOString(),
    finishedAt: "",
  };

  // Stage 1 — network only: fetch details, 5 at a time (no transaction open yet)
  const fetched = await settleInBatches(ids, DETAIL_BATCH_SIZE, (id) =>
    getMovieDetails(id).then((d) => withPlayableTrailer(d))
  );
  const inputs: MovieSyncInput[] = [];
  fetched.forEach((result, i) => {
    if (result.status === "fulfilled") {
      const input = mapTmdbToMovieInput(result.value, startedAt);
      // Discover also returns re-releases (e.g. a 1997 film back in cinemas): their earliest Thai
      // cinema date is in the past, so they are not "upcoming". Skip them rather than fake a date.
      if (i >= nowPlayingIds.length && input.releaseDate <= startedAt) {
        summary.skipped++;
        return;
      }
      inputs.push(input);
    } else {
      summary.failed++;
      summary.errors.push(`tmdbId ${ids[i]}: ${reasonOf(result.reason)}`);
    }
  });

  // Stage 2 — two set-based queries for the whole batch
  const [existing, genreIds] = await Promise.all([
    prisma.movie.findMany({
      where: { tmdbId: { in: inputs.map((m) => m.tmdbId) } },
      select: { tmdbId: true },
    }),
    resolveGenreIds(inputs.flatMap((m) => m.genres)),
  ]);
  const existingIds = new Set(existing.map((m) => m.tmdbId));

  // Stage 3 — one small transaction per movie
  const saved = await settleInBatches(inputs, UPSERT_BATCH_SIZE, (input) =>
    upsertMovie(input, genreIds)
  );
  saved.forEach((result, i) => {
    if (result.status === "fulfilled") {
      summary[existingIds.has(inputs[i].tmdbId) ? "updated" : "created"]++;
    } else {
      summary.failed++;
      summary.errors.push(`tmdbId ${inputs[i].tmdbId}: ${reasonOf(result.reason)}`);
    }
  });

  summary.finishedAt = new Date().toISOString();
  return summary;
}

export interface AdminSearchResult {
  tmdbId: number;
  title: string;
  releaseDate: string | null;
  posterUrl: string | null;
  overview: string;
  alreadyImported: boolean;
}

/** TMDB search for the admin page, flagged with which titles are already imported. */
export async function searchTmdbForAdmin(query: string): Promise<AdminSearchResult[]> {
  const data = await searchMovies(query);
  const top = data.results.slice(0, 10);

  const imported = await prisma.movie.findMany({
    where: { tmdbId: { in: top.map((m) => m.id) } },
    select: { tmdbId: true },
  });
  const importedIds = new Set(imported.map((m) => m.tmdbId));

  return top.map((m) => ({
    tmdbId: m.id,
    title: m.title,
    releaseDate: m.release_date || null,
    posterUrl: m.poster_path ? getTmdbImageUrl(m.poster_path, "w500") : null,
    overview: m.overview,
    alreadyImported: importedIds.has(m.id),
  }));
}
