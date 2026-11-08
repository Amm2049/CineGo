// src/tests/integration/movie-sync.test.ts
// Bulk TMDB sync (Phase 10): English-language films only, upcoming from Discover (Thai release in the
// next ~6 months), re-releases skipped. TMDB is faked; the database is real. Test movies use tmdbIds
// far above real ones and are removed afterwards.

import { afterAll, describe, expect, it, vi } from "vitest";
import type { TmdbMovieDetails, TmdbMovieSummary } from "@/lib/tmdb";

const BASE = 900_000_000 + (Date.now() % 1_000_000) * 10; // unique per run, never a real TMDB id

const tmdb = vi.hoisted(() => ({
  nowPlaying: [] as TmdbMovieSummary[],
  discover: [] as TmdbMovieSummary[],
  details: new Map<number, TmdbMovieDetails>(),
  discoverWindows: [] as { from: string; to: string }[],
}));

vi.mock("@/lib/tmdb", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/tmdb")>();
  return {
    ...real,
    hasTmdbCredentials: () => true,
    getNowPlayingMovies: async () => ({ page: 1, results: tmdb.nowPlaying, total_pages: 1, total_results: 0 }),
    discoverUpcomingInThailand: async (_page: number, window: { from: string; to: string }) => {
      tmdb.discoverWindows.push(window);
      return { page: 1, results: tmdb.discover, total_pages: 1, total_results: 0 };
    },
    getMovieDetails: async (id: number) => tmdb.details.get(id)!,
  };
});

import prisma from "@/lib/prisma";
import { syncLatestReleases } from "@/services/movie-sync.service";
import { todayInCinemaTz } from "@/lib/schedule";

/** A TMDB title whose Thai cinema release is `thaiDate`. */
function title(offset: number, lang: string, thaiDate: string) {
  const id = BASE + offset;
  tmdb.details.set(id, {
    id,
    title: `Sync Test ${offset} (${lang})`,
    overview: "Test.",
    runtime: 100,
    release_date: thaiDate,
    poster_path: "/p.jpg",
    backdrop_path: "/b.jpg",
    genres: [{ id: 28, name: "Action" }],
    vote_average: 7,
    tagline: null,
    status: "Released",
    original_language: lang,
    release_dates: {
      results: [{ iso_3166_1: "TH", release_dates: [{ release_date: `${thaiDate}T00:00:00.000Z`, type: 3, certification: "" }] }],
    },
  });
  return { id, original_language: lang } as TmdbMovieSummary;
}

afterAll(async () => {
  const movies = await prisma.movie.findMany({ where: { tmdbId: { gte: BASE, lt: BASE + 10 } }, select: { id: true } });
  await prisma.movieGenre.deleteMany({ where: { movieId: { in: movies.map((m) => m.id) } } });
  await prisma.movie.deleteMany({ where: { id: { in: movies.map((m) => m.id) } } });
});

describe("bulk TMDB sync", () => {
  it("saves English titles only, takes upcoming from Discover and skips re-releases", async () => {
    tmdb.nowPlaying = [title(1, "en", "2026-10-01"), title(2, "th", "2026-10-01")];
    tmdb.discover = [
      title(3, "en", "2099-01-15"), // upcoming
      title(4, "ko", "2099-02-01"), // not English
      title(5, "en", "1997-03-28"), // re-release: earliest Thai cinema date is in the past
    ];

    const summary = await syncLatestReleases();

    const saved = await prisma.movie.findMany({
      where: { tmdbId: { gte: BASE, lt: BASE + 10 } },
      select: { tmdbId: true },
      orderBy: { tmdbId: "asc" },
    });
    expect(saved.map((m) => m.tmdbId! - BASE)).toEqual([1, 3]);
    expect(summary).toMatchObject({ total: 3, created: 2, skipped: 1, failed: 0 }); // 3 English candidates

    // Discover asks for Thai releases from tomorrow to ~6 months ahead
    const [window] = tmdb.discoverWindows;
    const days = (Date.parse(window.to) - Date.parse(window.from)) / 86_400_000;
    expect(window.from > todayInCinemaTz()).toBe(true); // starts tomorrow (Bangkok)
    expect(days).toBeGreaterThanOrEqual(180);
  });
});
