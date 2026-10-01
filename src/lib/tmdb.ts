// src/lib/tmdb.ts
// CineGo -- TMDB REST API Client Wrapper

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbMovieSummary {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  popularity: number;
}

export interface TmdbMovieDetails {
  id: number;
  title: string;
  overview: string;
  runtime: number | null;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: TmdbGenre[];
  vote_average: number;
  tagline: string | null;
  status: string;
}

export interface TmdbPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export function hasTmdbCredentials(): boolean {
  const apiKey = process.env.TMDB_API_KEY;
  const token = process.env.TMDB_READ_ACCESS_TOKEN || process.env.TMDB_ACCESS_TOKEN;
  return Boolean(
    (apiKey && apiKey !== "your-tmdb-api-key-here" && apiKey.trim().length > 0) ||
    (token && token !== "your-tmdb-access-token-here" && token.trim().length > 0)
  );
}

function getRequestConfig(endpoint: string, params: Record<string, string | number> = {}) {
  const apiKey = process.env.TMDB_API_KEY;
  const token = process.env.TMDB_READ_ACCESS_TOKEN || process.env.TMDB_ACCESS_TOKEN;

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (token && token.trim().length > 0) {
    headers.Authorization = `Bearer ${token.trim()}`;
  } else if (apiKey && apiKey.trim().length > 0) {
    url.searchParams.set("api_key", apiKey.trim());
  }

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  return { url: url.toString(), headers };
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
  const { url, headers } = getRequestConfig(endpoint, params);

  const res = await fetch(url, {
    headers,
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`TMDB API Error [${res.status} ${res.statusText}]: ${errorText}`);
  }

  return res.json() as Promise<T>;
}

export function getTmdbImageUrl(
  path: string | null | undefined,
  size: "w500" | "original" = "w500"
): string {
  if (!path) {
    return "/images/placeholder-poster.svg";
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${TMDB_IMAGE_BASE_URL}/${size}${path.startsWith("/") ? path : "/" + path}`;
}

export async function searchMovies(
  query: string,
  page = 1
): Promise<TmdbPaginatedResponse<TmdbMovieSummary>> {
  if (!query.trim()) {
    return { page: 1, results: [], total_pages: 0, total_results: 0 };
  }
  return tmdbFetch<TmdbPaginatedResponse<TmdbMovieSummary>>("/search/movie", {
    query: query.trim(),
    page,
    include_adult: "false",
    language: "en-US",
  });
}

export async function getMovieDetails(tmdbId: number): Promise<TmdbMovieDetails> {
  return tmdbFetch<TmdbMovieDetails>(`/movie/${tmdbId}`, {
    language: "en-US",
  });
}

export async function getNowPlayingMovies(
  page = 1
): Promise<TmdbPaginatedResponse<TmdbMovieSummary>> {
  return tmdbFetch<TmdbPaginatedResponse<TmdbMovieSummary>>("/movie/now_playing", {
    page,
    language: "en-US",
  });
}

export async function getUpcomingMovies(
  page = 1
): Promise<TmdbPaginatedResponse<TmdbMovieSummary>> {
  return tmdbFetch<TmdbPaginatedResponse<TmdbMovieSummary>>("/movie/upcoming", {
    page,
    language: "en-US",
  });
}

export async function getTmdbGenres(): Promise<TmdbGenre[]> {
  const data = await tmdbFetch<{ genres: TmdbGenre[] }>("/genre/movie/list", {
    language: "en-US",
  });
  return data.genres;
}
