// src/services/recommendation.service.ts
// CineGo -- Hybrid AI Movie Recommendation Engine
// Backed by PostgreSQL JSON persistence + In-flight deduplication + Google Gemini LLM API

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

// In-flight deduplication map: coalesces concurrent requests for the same user
const inFlightRequests = new Map<string, Promise<RecommendationMap>>();

/**
 * Invalidate cached recommendations for a user (e.g. when interests change or booking completes).
 */
export async function invalidateUserRecommendations(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        recommendations: Prisma.DbNull,
        recommendationsUpdatedAt: null,
      },
    });
  } catch (err) {
    console.error("[RecommendationService] Error invalidating user recommendations:", err);
  }
}

/**
 * Heuristic fallback calculation based on genre overlap.
 * Used when Gemini API is unconfigured, times out, or encounters quota limits.
 */
function calculateHeuristicRecommendations(
  userGenres: string[],
  movies: CandidateMovie[]
): MovieRecommendation[] {
  const userGenreSet = new Set(userGenres.map((g) => g.toLowerCase()));

  return movies.map((movie) => {
    const movieGenres = movie.genres.map((g) => g.toLowerCase());
    const matchingGenres = movieGenres.filter((g) => userGenreSet.has(g));

    let matchScore = 60;
    let reason = "Recommended based on trending titles in our cinema catalog.";

    if (userGenres.length === 0) {
      matchScore = 70;
      reason = "Popular choice among cinema goers. Select your favorite genres in Profile for tailored matches.";
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

/**
 * Raw computation of recommendations via Gemini LLM or heuristic fallback.
 * Scores the cinema catalog for a user given their genre interests & booking history.
 */
async function computeRawRecommendations(
  userId: string,
  candidateMovieIds?: string[]
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
      include: {
        genres: { include: { genre: true } },
      },
      take: 50,
      orderBy: { releaseDate: "desc" },
    }),
  ]);

  const userGenres = userInterests.map((ui) => ui.genre.name);
  const pastMovieTitles = Array.from(
    new Set(pastBookings.map((b) => b.showtime.movie.title))
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
    console.info("[RecommendationService] GOOGLE_GEMINI_API_KEY not configured. Using heuristic matching.");
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
      },
    });

    const responseText = response.text?.trim() || "";
    const parsed = JSON.parse(responseText);

    if (Array.isArray(parsed) && parsed.length > 0) {
      const validRecommendations: MovieRecommendation[] = parsed
        .filter((item) => item && typeof item.movieId === "string")
        .map((item) => ({
          movieId: String(item.movieId),
          matchScore: Math.min(99, Math.max(50, Math.round(Number(item.matchScore) || 70))),
          reason: String(item.reason || "Recommended based on your cinematic taste profile."),
        }));

      if (validRecommendations.length > 0) {
        // Gap-filling: ensure 100% of candidate movies have a score
        const returnedIds = new Set(validRecommendations.map((r) => r.movieId));
        const missingMovies = candidateMovies.filter((m) => !returnedIds.has(m.id));
        if (missingMovies.length > 0) {
          const fallbackRecs = calculateHeuristicRecommendations(userGenres, missingMovies);
          validRecommendations.push(...fallbackRecs);
        }
        return validRecommendations;
      }
    }

    console.warn("[RecommendationService] Gemini returned invalid format. Falling back to heuristic.");
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
  candidateMovieIds?: string[]
): Promise<RecommendationMap> {
  const recommendations = await computeRawRecommendations(userId, candidateMovieIds);
  const map: RecommendationMap = {};

  for (const rec of recommendations) {
    map[rec.movieId] = rec;
  }

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
    console.error("[RecommendationService] Failed to persist recommendations to DB:", err);
  }

  return map;
}

/**
 * Fetch personalized movie recommendations map for a user.
 * 1. Checks PostgreSQL for cached recommendations (fresh within 24h).
 * 2. If present and fresh -> returns in ~2-5ms (zero LLM overhead).
 * 3. If stale or missing -> coalesces concurrent in-flight requests and computes via Gemini,
 *    storing the results to Postgres before returning.
 */
export async function getMovieRecommendationsMap(
  userId: string,
  candidateMovieIds?: string[]
): Promise<RecommendationMap> {
  if (!userId) return {};

  // 1. In-flight coalescing: share promise if another request is already computing for this user
  const existingPromise = inFlightRequests.get(userId);
  if (existingPromise) {
    return existingPromise;
  }

  // 2. Check Database for cached recommendations
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        recommendations: true,
        recommendationsUpdatedAt: true,
      },
    });

    if (user?.recommendations && user.recommendationsUpdatedAt) {
      const ageMs = Date.now() - new Date(user.recommendationsUpdatedAt).getTime();
      if (ageMs < RECOMMENDATION_TTL_MS) {
        const cachedMap = user.recommendations as unknown as RecommendationMap;
        if (typeof cachedMap === "object" && cachedMap !== null && Object.keys(cachedMap).length > 0) {
          // If candidate IDs are specified, ensure at least one matches our cached catalog
          if (!candidateMovieIds || candidateMovieIds.length === 0 || candidateMovieIds.some((id) => cachedMap[id])) {
            return cachedMap;
          }
        }
      }
    }
  } catch (err) {
    console.error("[RecommendationService] Error querying cached recommendations:", err);
  }

  // 3. Cache miss or stale: compute on demand with in-flight deduplication
  const computePromise = (async () => {
    try {
      return await computeAndStoreRecommendations(userId, candidateMovieIds);
    } finally {
      inFlightRequests.delete(userId);
    }
  })();

  inFlightRequests.set(userId, computePromise);
  return computePromise;
}

/**
 * Convenience helper returning recommendations as an array for backward compatibility.
 */
export async function getMovieRecommendations(
  userId: string,
  candidateMovieIds?: string[]
): Promise<MovieRecommendation[]> {
  const map = await getMovieRecommendationsMap(userId, candidateMovieIds);
  const list = Object.values(map);

  if (candidateMovieIds && candidateMovieIds.length > 0) {
    const set = new Set(candidateMovieIds);
    return list.filter((r) => set.has(r.movieId));
  }

  return list;
}
