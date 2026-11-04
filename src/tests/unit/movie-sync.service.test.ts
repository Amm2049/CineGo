// src/tests/unit/movie-sync.service.test.ts
import { describe, it, expect } from "vitest";
import { mapTmdbToMovieInput, normalizeGenreName } from "@/services/movie-sync.service";
import type { TmdbMovieDetails } from "@/lib/tmdb";

const NOW = new Date("2026-11-04T12:00:00Z");

function details(overrides: Partial<TmdbMovieDetails> = {}): TmdbMovieDetails {
  return {
    id: 42,
    title: "Test Movie",
    overview: "A test.",
    runtime: 110,
    release_date: "2026-10-01",
    poster_path: "/p.jpg",
    backdrop_path: "/b.jpg",
    genres: [
      { id: 878, name: "Science Fiction" },
      { id: 28, name: "Action" },
    ],
    vote_average: 7,
    tagline: null,
    status: "Released",
    ...overrides,
  };
}

const thai = (...dates: [string, number][]) => ({
  results: [
    { iso_3166_1: "US", release_dates: [{ release_date: "2026-10-01T00:00:00.000Z", type: 3, certification: "" }] },
    { iso_3166_1: "TH", release_dates: dates.map(([release_date, type]) => ({ release_date, type, certification: "" })) },
  ],
});

describe("mapTmdbToMovieInput", () => {
  it("uses the Thai theatrical date, not the worldwide one", () => {
    const m = mapTmdbToMovieInput(details({ release_dates: thai(["2026-11-20T00:00:00.000Z", 3]) }), NOW);
    expect(m.releaseDate.toISOString().slice(0, 10)).toBe("2026-11-20");
  });

  it("ignores Thai digital/TV releases and picks the earliest cinema date", () => {
    const m = mapTmdbToMovieInput(
      details({
        release_dates: thai(
          ["2026-09-01T00:00:00.000Z", 4],
          ["2026-11-27T00:00:00.000Z", 3],
          ["2026-11-13T00:00:00.000Z", 2]
        ),
      }),
      NOW
    );
    expect(m.releaseDate.toISOString().slice(0, 10)).toBe("2026-11-13");
  });

  it("falls back to TMDB's worldwide date and never invents one", () => {
    const m = mapTmdbToMovieInput(details({ release_date: "1999-03-31" }), NOW);
    expect(m.releaseDate.toISOString().slice(0, 10)).toBe("1999-03-31");
  });

  it("falls back to 120 minutes when runtime is missing", () => {
    expect(mapTmdbToMovieInput(details({ runtime: null }), NOW).duration).toBe(120);
  });

  it("renames Science Fiction to Sci-Fi and removes duplicates", () => {
    const m = mapTmdbToMovieInput(
      details({ genres: [{ id: 1, name: "Science Fiction" }, { id: 2, name: "Sci-Fi" }] }),
      NOW
    );
    expect(m.genres).toEqual(["Sci-Fi"]);
    expect(normalizeGenreName("Drama")).toBe("Drama");
  });

  it("builds full TMDB image URLs", () => {
    expect(mapTmdbToMovieInput(details(), NOW).posterUrl).toBe("https://image.tmdb.org/t/p/w500/p.jpg");
  });
});
