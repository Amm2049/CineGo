// src/services/recommendation.service.ts
// CineGo -- Hybrid AI Movie Recommendation Engine
// Backed by PostgreSQL JSON persistence + In-flight deduplication + Google Gemini LLM API

import { after } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { geminiClient, GEMINI_MODEL } from "@/lib/gemini";
import { MovieRecommendation, RecommendationMap } from "@/types";

interface CandidateMovie {
  id: string;
  title: string;
  description: string;
  genres: string[];
}

// 24-hour TTL for cached recommendations in the database
const RECOMMENDATION_TTL_MS = 24 * 60 * 60 * 1000;

// A Gemini call scores the whole catalog and takes ~30-55 s. It only ever runs in the
// background (after the response), so allow plenty of time but never hang forever.
const GEMINI_TIMEOUT_MS = 120_000;

// In-flight deduplication map: coalesces concurrent refreshes for the same user
const inFlightRequests = new Map<string, Promise<RecommendationMap>>();

/**
 * Mark a user's cached recommendations as stale (e.g. after a booking is paid).
 * The old scores stay visible until the background refresh replaces them, so the
 * next page load never waits for Gemini.
 */
export async function invalidateUserRecommendations(
  userId: string,
): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { recommendationsUpdatedAt: null },
    });
  } catch (err) {
    console.error(
      "[RecommendationService] Error invalidating user recommendations:",
      err,
    );
  }
}

/**
 * Heuristic fallback calculation based on genre overlap.
 * Used when Gemini API is unconfigured, times out, or encounters quota limits.
 */
function calculateHeuristicRecommendations(
  userGenres: string[],
  movies: CandidateMovie[],
): MovieRecommendation[] {
  const userGenreSet = new Set(userGenres.map((g) => g.toLowerCase()));

  return movies.map((movie) => {
    const movieGenres = movie.genres.map((g) => g.toLowerCase());
    const matchingGenres = movieGenres.filter((g) => userGenreSet.has(g));

    let matchScore = 60;
    let reason = "Recommended based on trending titles in our cinema catalog.";

    if (userGenres.length === 0) {
      matchScore = 70;
      reason =
        "Popular choice among cinema goers. Select your favorite genres in Profile for tailored matches.";
    } else if (matchingGenres.length >= 2) {
      matchScore = Math.min(97, 88 + matchingGenres.length * 3);
      reason = `Strong match because you love ${matchingGenres.join(" and ")}.`;
    } else if (matchingGenres.length === 1) {
      matchScore = 80;
      reason = `Matches your preference for ${matchingGenres[0]} films.`;
    } else {
      matchScore = 62;
      reason = `Explore outside your usual tastes with this featured ${movie.genres[0] || "cinema"} title.`;
    }

    return {
      movieId: movie.id,
      matchScore,
      reason,
    };
  });
}

function toMap(recommendations: MovieRecommendation[]): RecommendationMap {
  const map: RecommendationMap = {};
  for (const rec of recommendations) map[rec.movieId] = rec;
  return map;
}

/** Fast genre-overlap scores (two DB queries, no LLM) shown while Gemini runs in the background. */
async function computeHeuristicMap(userId: string): Promise<RecommendationMap> {
  const [userInterests, movies] = await Promise.all([
    prisma.userInterest.findMany({
      where: { userId },
      include: { genre: true },
    }),
    prisma.movie.findMany({
      where: { isActive: true },
      include: { genres: { include: { genre: true } } },
      take: 50,
      orderBy: { releaseDate: "desc" },
    }),
  ]);
  return toMap(
    calculateHeuristicRecommendations(
      userInterests.map((ui) => ui.genre.name),
      movies.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        genres: m.genres.map((g) => g.genre.name),
      })),
    ),
  );
}

/**
 * Raw computation of recommendations via Gemini LLM or heuristic fallback.
 * Scores the cinema catalog for a user given their genre interests & booking history.
 */
async function computeRawRecommendations(
  userId: string,
): Promise<MovieRecommendation[]> {
  // 1. Fetch user genre preferences, booking history, and active catalog movies in parallel
  const [userInterests, pastBookings, allMoviesRaw] = await Promise.all([
    prisma.userInterest.findMany({
      where: { userId },
      include: { genre: true },
    }),
    prisma.booking.findMany({
      where: { userId, status: "PAID" },
      include: {
        showtime: {
          include: {
            movie: {
              include: {
                genres: { include: { genre: true } },
              },
            },
          },
        },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
    prisma.movie.findMany({
      where: { isActive: true },
      include: {
        genres: { include: { genre: true } },
      },
      take: 50,
      orderBy: { releaseDate: "desc" },
    }),
  ]);

  const userGenres = userInterests.map((ui) => ui.genre.name);
  const pastMovieTitles = Array.from(
    new Set(pastBookings.map((b) => b.showtime.movie.title)),
  );

  const candidateMovies: CandidateMovie[] = allMoviesRaw.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    genres: m.genres.map((g) => g.genre.name),
  }));

  if (candidateMovies.length === 0) {
    return [];
  }

  // 2. If Gemini Client is not initialized (no API key), use heuristic fallback
  if (!geminiClient) {
    console.info(
      "[RecommendationService] GOOGLE_GEMINI_API_KEY not configured. Using heuristic matching.",
    );
    return calculateHeuristicRecommendations(userGenres, candidateMovies);
  }

  // 3. Construct structured prompt for Gemini
  const prompt = `
You are CineGo's intelligent cinema recommendation engine.
Analyze this user's profile and recommend candidate movies by calculating a personalized matchScore (integer between 50 and 98) and a concise, compelling 1-sentence reason.

User Profile:
- Favorite Genres: ${userGenres.length > 0 ? userGenres.join(", ") : "None specified yet"}
- Recently Watched / Booked Movies: ${pastMovieTitles.length > 0 ? pastMovieTitles.join(", ") : "No prior bookings"}

Candidate Movies to Score:
${JSON.stringify(candidateMovies, null, 2)}

Strict Instructions:
1. Return a valid JSON array containing objects with:
   - "movieId": string (must match the movie's exact id)
   - "matchScore": number (integer between 50 and 98; score higher if genres overlap or themes match past favorites)
   - "reason": string (a concise, punchy 1-sentence explanation of why this movie fits the user)
2. Return ONLY the raw JSON array. Do not include markdown code fences or conversational text.
`;

  try {
    const response = await geminiClient.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        httpOptions: { timeout: GEMINI_TIMEOUT_MS },
      },
    });

    const responseText = response.text?.trim() || "";
    const parsed = JSON.parse(responseText);

    if (Array.isArray(parsed) && parsed.length > 0) {
      const validRecommendations: MovieRecommendation[] = parsed
        .filter((item) => item && typeof item.movieId === "string")
        .map((item) => ({
          movieId: String(item.movieId),
          matchScore: Math.min(
            99,
            Math.max(50, Math.round(Number(item.matchScore) || 70)),
          ),
          reason: String(
            item.reason || "Recommended based on your cinematic taste profile.",
          ),
        }));

      if (validRecommendations.length > 0) {
        // Gap-filling: ensure 100% of candidate movies have a score
        const returnedIds = new Set(validRecommendations.map((r) => r.movieId));
        const missingMovies = candidateMovies.filter(
          (m) => !returnedIds.has(m.id),
        );
        if (missingMovies.length > 0) {
          const fallbackRecs = calculateHeuristicRecommendations(
            userGenres,
            missingMovies,
          );
          validRecommendations.push(...fallbackRecs);
        }
        return validRecommendations;
      }
    }

    console.warn(
      "[RecommendationService] Gemini returned invalid format. Falling back to heuristic.",
    );
    return calculateHeuristicRecommendations(userGenres, candidateMovies);
  } catch (error) {
    console.error("[RecommendationService] Gemini API call error:", error);
    return calculateHeuristicRecommendations(userGenres, candidateMovies);
  }
}

/**
 * Computes recommendations and persists them to the User record in PostgreSQL.
 */
async function computeAndStoreRecommendations(
  userId: string,
): Promise<RecommendationMap> {
  const map = toMap(await computeRawRecommendations(userId));

  // Persist to database so subsequent page loads read from DB (~3ms)
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        recommendations: map as unknown as Prisma.InputJsonObject,
        recommendationsUpdatedAt: new Date(),
      },
    });
  } catch (err) {
    console.error(
      "[RecommendationService] Failed to persist recommendations to DB:",
      err,
    );
  }

  return map;
}

/** Start a Gemini refresh for this user unless one is already running. */
function refreshRecommendations(userId: string): Promise<RecommendationMap> {
  const existing = inFlightRequests.get(userId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      return await computeAndStoreRecommendations(userId);
    } finally {
      inFlightRequests.delete(userId);
    }
  })();
  inFlightRequests.set(userId, promise);
  return promise;
}

/**
 * Run the refresh after the response has been sent (Next.js `after`), so no page
 * waits for Gemini. Outside a request (scripts, tests) it simply runs detached.
 */
function scheduleRefresh(userId: string): void {
  if (inFlightRequests.has(userId)) return;
  const run = () =>
    refreshRecommendations(userId)
      .then(() => undefined)
      .catch((err) =>
        console.error("[RecommendationService] Background refresh failed:", err),
      );
  try {
    after(run);
  } catch {
    void run();
  }
}

/**
 * Fetch personalized movie recommendations map for a user. Never waits for Gemini:
 * 1. Fresh cache (within 24h, covering the requested movies) -> returned as-is (~3-5ms).
 * 2. Stale cache (expired, marked stale after a booking, or missing new movies)
 *    -> returned as-is while Gemini refreshes in the background.
 * 3. No cache (new user or genres just changed) -> fast genre-overlap scores now,
 *    Gemini refresh in the background. The next page load shows the AI scores.
 */
export async function getMovieRecommendationsMap(
  userId: string,
  candidateMovieIds?: string[],
): Promise<RecommendationMap> {
  if (!userId) return {};

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        recommendations: true,
        recommendationsUpdatedAt: true,
        _count: { select: { interests: true, bookings: { where: { status: "PAID" } } } },
      },
    });

    // Nothing to personalise from yet (new customer: no favourite genres, no bookings). Show no
    // match badges rather than the same score on every movie, and don't call Gemini (Phase 10).
    if (!user || (user._count.interests === 0 && user._count.bookings === 0)) return {};

    const cachedMap = user?.recommendations as unknown as
      | RecommendationMap
      | null
      | undefined;

    if (
      cachedMap &&
      typeof cachedMap === "object" &&
      Object.keys(cachedMap).length > 0
    ) {
      const fresh =
        user?.recommendationsUpdatedAt != null &&
        Date.now() - new Date(user.recommendationsUpdatedAt).getTime() <
          RECOMMENDATION_TTL_MS;
      const coversCatalog =
        !candidateMovieIds ||
        candidateMovieIds.length === 0 ||
        candidateMovieIds.some((id) => cachedMap[id]);

      if (!fresh || !coversCatalog) scheduleRefresh(userId);
      return cachedMap;
    }
  } catch (err) {
    console.error(
      "[RecommendationService] Error querying cached recommendations:",
      err,
    );
  }

  scheduleRefresh(userId);
  try {
    return await computeHeuristicMap(userId);
  } catch (err) {
    console.error("[RecommendationService] Heuristic fallback failed:", err);
    return {};
  }
}

/**
 * Convenience helper returning recommendations as an array for backward compatibility.
 */
export async function getMovieRecommendations(
  userId: string,
  candidateMovieIds?: string[],
): Promise<MovieRecommendation[]> {
  const map = await getMovieRecommendationsMap(userId, candidateMovieIds);
  const list = Object.values(map);

  if (candidateMovieIds && candidateMovieIds.length > 0) {
    const set = new Set(candidateMovieIds);
    return list.filter((r) => set.has(r.movieId));
  }

  return list;
}
