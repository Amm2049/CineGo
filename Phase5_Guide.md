# Phase 5: Step-by-Step Implementation Guide

**Goal:** Integrate the Google Gemini LLM API (`@google/genai`) to power the AI Movie Recommendation Engine, generate structured JSON match scores and 1-sentence cinematic reasons based on customer genre preferences and booking history, build the `/api/recommendations` endpoint, and render glowing in-line `🔥 {matchScore}% AI Match` badges with AI insights on movie cards across the Homepage and Movies Catalog.

**Source of truth:** `CiniGo_Phase_Plan.md` lines 131–153 | `CiniGo_Scope.md` Sections 2.1, 3, 4.1, 5 (FR-02), 7

---

## Overview — What We Build in Phase 5

```
phase/phase5-recommendations
   ├── feature/gemini-service     (@google/genai SDK, gemini.ts client, recommendation.service.ts with prompt engineering & heuristic fallback, GET /api/recommendations)
   └── feature/recommendation-ui  (TypeScript types, MovieCard in-line badge & insight hover/callout, Homepage Server Component integration, Movies Catalog 2-tab integration)
```

### Key Deliverables:
- **`package.json`** — Install `@google/genai` (Google's official GenAI SDK).
- **`src/lib/gemini.ts`** — Configure Gemini client singleton with graceful handling for missing or unconfigured environment variables.
- **`src/types/index.ts`** — Export `MovieRecommendation` and `RecommendationMap` type definitions.
- **`src/services/recommendation.service.ts`** — Domain service fetching `UserInterest` genres + past `Booking` history, sending structured prompts to Gemini for JSON output (`movieId`, `matchScore`, `reason`), with an intelligent heuristic fallback mechanism.
- **`src/app/api/recommendations/route.ts`** — Authenticated Next.js Route Handler (`GET /api/recommendations`) exposing personalized recommendations to client components and external consumers.
- **`src/components/movies/MovieCard.tsx`** — Enhanced movie card displaying glowing in-line `🔥 {matchScore}% AI Match` badges and 1-sentence AI insights (`matchReason`).
- **`src/app/page.tsx`** — Homepage Server Component passing personalized recommendations to Now Showing and Upcoming movie cards for authenticated users.
- **`src/app/(customer)/movies/page.tsx` & `MoviesCatalogClient.tsx`** — 2-Tab Movies Catalog displaying personalized AI match badges across both tabs.

---

## Step 1: Git Branching Setup

Ensure your local `develop` branch is clean and up to date, then branch the permanent phase milestone and the first feature branch:

```bash
# Checkout develop and ensure it is synced
git checkout develop
git pull origin develop

# Create the permanent milestone branch (NEVER delete)
git checkout -b phase/phase5-recommendations
git push origin phase/phase5-recommendations

# Create the first feature branch
git checkout -b feature/gemini-service
```

Your branch hierarchy is now:
```
main
develop
  └── phase/phase5-recommendations      <-- Permanent Phase Milestone (NEVER delete)
        └── feature/gemini-service      <-- You are HERE
```

---

## Step 2: Install Google GenAI SDK & Check Environment Variables

Install Google's official Gemini SDK (`@google/genai`):

```bash
npm install @google/genai
```

Verify your `.env` contains `GOOGLE_GEMINI_API_KEY`:

```env
# ── Google Gemini API (Phase 5) ─────────────────────────────
# Get your API key from: https://aistudio.google.com/
GOOGLE_GEMINI_API_KEY=your_actual_gemini_api_key_here
```

> **Engineering Principle — Resilient Architecture:**
> Real-world cloud services may encounter network timeouts, invalid API keys, or rate limits (e.g., HTTP 429). The implementation in this guide includes a deterministic **heuristic genre-overlap fallback**. If Gemini is unreachable or the API key is omitted, the recommendation engine calculates realistic match scores from user preferences without crashing the application.

---

## Step 3: Configure Gemini Client Singleton (`src/lib/gemini.ts`)

Replace the stub in `src/lib/gemini.ts` with a singleton instance of `GoogleGenAI`:

```typescript
// src/lib/gemini.ts
// Google Gemini LLM API client singleton using @google/genai SDK

import { GoogleGenAI } from "@google/genai";

const apiKey =
  process.env.GOOGLE_GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  "";

// Initialize client only if API key is provided
export const geminiClient = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const GEMINI_MODEL = "gemini-2.5-flash";
```

---

## Step 4: Implement AI Recommendation Service Layer (`src/services/recommendation.service.ts`)

Create `src/services/recommendation.service.ts` to implement:
1. Retrieval of user favorite genres (`UserInterest`) and past bookings (`Booking`).
2. Structured prompt generation for candidate movies.
3. Structured JSON request to Google Gemini (`responseMimeType: "application/json"`).
4. Deterministic heuristic fallback when Gemini is unavailable or unconfigured.

```typescript
// src/services/recommendation.service.ts
// CineGo -- AI Movie Recommendation Engine powered by Google Gemini LLM API

import prisma from "@/lib/prisma";
import { geminiClient, GEMINI_MODEL } from "@/lib/gemini";
import { MovieRecommendation, RecommendationMap } from "@/types";

interface CandidateMovie {
  id: string;
  title: string;
  description: string;
  genres: string[];
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
 * Fetch personalized movie recommendations for a given user.
 * Combines user favorite genres & past booked movies, queries Gemini LLM for JSON scoring,
 * and falls back gracefully to heuristic matching if Gemini is unavailable.
 */
export async function getMovieRecommendations(
  userId: string,
  candidateMovieIds?: string[]
): Promise<MovieRecommendation[]> {
  // 1. Fetch user genre preferences & past booking history in parallel
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
      where: candidateMovieIds ? { id: { in: candidateMovieIds } } : undefined,
      include: {
        genres: { include: { genre: true } },
      },
      take: 20,
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
      // Validate and sanitize records
      const validRecommendations: MovieRecommendation[] = parsed
        .filter((item) => item && typeof item.movieId === "string")
        .map((item) => ({
          movieId: String(item.movieId),
          matchScore: Math.min(99, Math.max(50, Math.round(Number(item.matchScore) || 70))),
          reason: String(item.reason || "Recommended based on your cinematic taste profile."),
        }));

      if (validRecommendations.length > 0) {
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
 * Convenience helper to return recommendations mapped by movieId for O(1) lookups.
 */
export async function getMovieRecommendationsMap(
  userId: string,
  candidateMovieIds?: string[]
): Promise<RecommendationMap> {
  const recommendations = await getMovieRecommendations(userId, candidateMovieIds);
  const map: RecommendationMap = {};

  for (const rec of recommendations) {
    map[rec.movieId] = rec;
  }

  return map;
}
```

---

## Step 5: Build Recommendation Route Handler (`src/app/api/recommendations/route.ts`)

Create `src/app/api/recommendations/route.ts` to expose the recommendation engine via a RESTful endpoint:

```typescript
// src/app/api/recommendations/route.ts
// Lightweight GET Route Handler returning AI match recommendations for authenticated users

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMovieRecommendations } from "@/services/recommendation.service";

// GET /api/recommendations
export async function GET() {
  const session = await getServerSession(authOptions);

  // If user is not authenticated, return empty recommendations without throwing
  if (!session?.user?.id) {
    return NextResponse.json({
      authenticated: false,
      recommendations: [],
      message: "Sign in and select favorite genres to receive personalized AI recommendations.",
    });
  }

  try {
    const recommendations = await getMovieRecommendations(session.user.id);

    return NextResponse.json({
      authenticated: true,
      count: recommendations.length,
      recommendations,
    });
  } catch (error) {
    console.error("[API] Error fetching recommendations:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
```

---

## Step 6: Commit `feature/gemini-service` and Merge

Verify TypeScript and linting:

```bash
npm run lint
```

Commit changes and merge into `phase/phase5-recommendations`:

```bash
git add .
git commit -m "feat(phase5): Gemini GenAI client singleton, recommendation service with heuristic fallback, and GET /api/recommendations"

# Merge into milestone branch
git checkout phase/phase5-recommendations
git merge feature/gemini-service

# Delete temporary feature branch
git branch -d feature/gemini-service
```

---

## Step 7: Git Branch `feature/recommendation-ui`

Branch the second feature branch for UI integration:

```bash
git checkout -b feature/recommendation-ui
```

---

## Step 8: Update TypeScript Definitions (`src/types/index.ts`)

Update `src/types/index.ts` to declare recommendation interfaces:

```typescript
// src/types/index.ts
// CineGo -- Shared TypeScript interfaces and type definitions

import { Movie, Genre, Showtime, Screen } from "@prisma/client";

export type MovieWithRelations = Movie & {
  genres: {
    genre: Genre;
  }[];
  showtimes?: (Showtime & {
    screen?: Screen;
  })[];
};

export interface MovieRecommendation {
  movieId: string;
  matchScore: number;
  reason: string;
}

export type RecommendationMap = Record<string, MovieRecommendation>;

export interface MovieCardProps {
  id: string;
  title: string;
  posterUrl: string;
  backdropUrl?: string;
  duration: number;
  releaseDate: Date | string;
  genres: string[];
  formats?: string[];
  matchScore?: number;
  matchReason?: string;
  isUpcoming?: boolean;
  priority?: boolean;
}

export interface GenrePreferenceItem {
  id: string;
  name: string;
  selected: boolean;
}

export interface SpotlightMovie {
  id: string;
  title: string;
  description: string;
  backdropUrl: string;
  posterUrl: string;
  duration: number;
  genres: string[];
  formats: string[];
}

export interface MovieItem {
  id: string;
  title: string;
  description: string;
  posterUrl: string;
  backdropUrl?: string;
  duration: number;
  releaseDate: string;
  genres: string[];
  formats: string[];
  isUpcoming: boolean;
  matchScore?: number;
  matchReason?: string;
}
```

---

## Step 9: Enhance Movie Card Component (`src/components/movies/MovieCard.tsx`)

Update `src/components/movies/MovieCard.tsx` to render:
1. Glowing in-line `🔥 {matchScore}% AI Match` badge.
2. Interactive hover tooltip or subtle 1-sentence AI insight callout (`matchReason`).

```tsx
// src/components/movies/MovieCard.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { formatDuration } from "@/lib/utils";
import { MovieCardProps } from "@/types";

export default function MovieCard({
  id,
  title,
  posterUrl,
  duration,
  releaseDate,
  genres,
  formats = ["Digital 4K"],
  matchScore,
  matchReason,
  isUpcoming = false,
  priority = false,
}: MovieCardProps) {
  const formattedDate = new Date(releaseDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link
      href={`/movies#movie-${id}`}
      className="group relative flex flex-col rounded-2xl bg-[#070820]/80 border border-[#2500f0]/30 hover:border-[#5938ff] transition-all duration-300 overflow-hidden shadow-lg hover:shadow-[#2500f0]/25 hover:-translate-y-1.5 focus:outline-none focus:ring-2 focus:ring-[#5938ff]"
    >
      {/* Poster Image Container with 2:3 Aspect Ratio */}
      <div className="relative w-full aspect-[2/3] overflow-hidden bg-[#03030d]">
        <Image
          src={posterUrl}
          alt={title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          priority={priority}
          className="object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Gradient Overlay for Contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#040412] via-transparent to-black/30 pointer-events-none" />

        {/* Top Badges: Format & AI Match */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1 pointer-events-none z-10">
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#040412]/80 text-[#c7d2fe] border border-white/15 backdrop-blur-md">
            {formats[0] || "Digital 4K"}
          </span>

          {typeof matchScore === "number" && (
            <span
              title={matchReason || `${matchScore}% Match based on your tastes`}
              className="text-[10px] font-black px-2 py-0.5 rounded-md bg-gradient-to-r from-[#2500f0] to-[#5938ff] text-white border border-[#a5b4fc]/50 shadow-[0_0_14px_rgba(37,0,240,0.85)] backdrop-blur-md animate-pulse pointer-events-auto cursor-help"
            >
              🔥 {matchScore}% AI Match
            </span>
          )}
        </div>

        {/* Bottom Bar: Runtime or Release Date */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-medium text-white/90 z-10">
          {isUpcoming ? (
            <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-amber-300 font-semibold border border-amber-500/30">
              Opens {formattedDate}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-zinc-300">
              {formatDuration(duration)}
            </span>
          )}
        </div>
      </div>

      {/* Meta Content */}
      <div className="relative z-10 -mt-px p-3.5 flex flex-col flex-1 justify-between gap-2 bg-[#06071e]">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white group-hover:text-[#c7d2fe] transition-colors line-clamp-1">
            {title}
          </h3>
          <p className="text-[11px] text-zinc-400 font-medium line-clamp-1">
            {genres.slice(0, 2).join(" · ")}
          </p>

          {/* 1-Sentence AI Insight */}
          {matchReason && (
            <p className="text-[10px] text-[#a5b4fc] line-clamp-1 italic bg-[#2500f0]/10 border border-[#2500f0]/20 rounded px-1.5 py-0.5 mt-1">
              ✨ {matchReason}
            </p>
          )}
        </div>

        <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px]">
          <span className="text-[#a5b4fc] font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
            {isUpcoming ? "View Details" : "Get Tickets"}
            <span>→</span>
          </span>
          {!isUpcoming && (
            <span className="text-[10px] uppercase font-bold text-emerald-400">
              Now Showing
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
```

---

## Step 10: Integrate AI Match Badges into Homepage (`src/app/page.tsx`)

Update `src/app/page.tsx` so authenticated users see personalized AI match scores on Now Showing and Upcoming cards:

```tsx
// src/app/page.tsx
// CineGo Homepage -- Server Component querying live PostgreSQL database & Gemini AI Recommendations

import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getNowShowingMovies, getUpcomingMovies } from "@/services/movie.service";
import { getMovieRecommendationsMap } from "@/services/recommendation.service";
import HeroSpotlight from "@/components/movies/HeroSpotlight";
import MovieCard from "@/components/movies/MovieCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  // Concurrently fetch movies & personalized recommendations if signed in
  const [nowShowingRaw, upcomingRaw] = await Promise.all([
    getNowShowingMovies({ limit: 5 }),
    getUpcomingMovies({ limit: 5 }),
  ]);

  const allMovieIds = [...nowShowingRaw.map((m) => m.id), ...upcomingRaw.map((m) => m.id)];

  const recommendationMap = session?.user?.id
    ? await getMovieRecommendationsMap(session.user.id, allMovieIds)
    : {};

  // Format Spotlight data for Hero
  const spotlightMovies = nowShowingRaw.map((m) => {
    const screens = m.showtimes.map((s) => s.screen.name);
    const uniqueFormats = Array.from(new Set(screens));
    return {
      id: m.id,
      title: m.title,
      description: m.description,
      backdropUrl: m.backdropUrl,
      posterUrl: m.posterUrl,
      duration: m.duration,
      genres: m.genres.map((g) => g.genre.name),
      formats: uniqueFormats.length > 0 ? uniqueFormats : ["IMAX Laser", "Dolby Cinema"],
    };
  });

  return (
    <main className="flex-1 flex flex-col bg-[#03030d] text-white">
      {/* Interactive Hero Banner */}
      <HeroSpotlight movies={spotlightMovies} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full space-y-16">
        {/* ── Section 1: Now Showing Preview (5 Cards) ── */}
        <section className="space-y-6">
          <div className="flex items-end justify-between border-b border-[#2500f0]/25 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] uppercase font-bold tracking-widest text-[#a5b4fc]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live In Theatres
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase mt-1">
                Now Showing
              </h2>
            </div>
            <Link
              href="/movies?tab=now-showing"
              className="text-xs font-bold text-[#c7d2fe] hover:text-white flex items-center gap-1 group transition-colors"
            >
              <span>View All Movies</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {nowShowingRaw.length === 0 ? (
            <div className="glass-panel rounded-2xl p-10 text-center space-y-3">
              <p className="text-zinc-400 text-sm">No movies currently showing with active showtimes.</p>
              <p className="text-xs text-zinc-500">Run the seed script or add showtimes via the database.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
              {nowShowingRaw.map((movie, idx) => {
                const screenNames = movie.showtimes.map((s) => s.screen.name);
                const uniqueFormats = Array.from(new Set(screenNames));
                const rec = recommendationMap[movie.id];

                return (
                  <MovieCard
                    key={movie.id}
                    id={movie.id}
                    title={movie.title}
                    posterUrl={movie.posterUrl}
                    duration={movie.duration}
                    releaseDate={movie.releaseDate}
                    genres={movie.genres.map((g) => g.genre.name)}
                    formats={uniqueFormats.length > 0 ? uniqueFormats : ["Digital 4K"]}
                    matchScore={rec?.matchScore}
                    matchReason={rec?.reason}
                    priority={idx < 2}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* ── Section 2: Upcoming Releases Preview (5 Cards) ── */}
        <section className="space-y-6">
          <div className="flex items-end justify-between border-b border-white/10 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] uppercase font-bold tracking-widest text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Coming Soon
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase mt-1">
                Upcoming Releases
              </h2>
            </div>
            <Link
              href="/movies?tab=upcoming"
              className="text-xs font-bold text-[#c7d2fe] hover:text-white flex items-center gap-1 group transition-colors"
            >
              <span>Explore All Upcoming</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {upcomingRaw.length === 0 ? (
            <div className="glass-panel rounded-2xl p-10 text-center">
              <p className="text-zinc-400 text-sm">No upcoming releases found in schedule.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
              {upcomingRaw.map((movie) => {
                const rec = recommendationMap[movie.id];
                return (
                  <MovieCard
                    key={movie.id}
                    id={movie.id}
                    title={movie.title}
                    posterUrl={movie.posterUrl}
                    duration={movie.duration}
                    releaseDate={movie.releaseDate}
                    genres={movie.genres.map((g) => g.genre.name)}
                    matchScore={rec?.matchScore}
                    matchReason={rec?.reason}
                    isUpcoming={true}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
```

---

## Step 11: Integrate AI Match Badges into Movies Catalog (`src/app/(customer)/movies/page.tsx`)

Update `src/app/(customer)/movies/page.tsx` and `MoviesCatalogClient.tsx` to pass and display recommendation data:

### 11.1 Update `src/app/(customer)/movies/page.tsx`:

```tsx
// src/app/(customer)/movies/page.tsx
// Movies Catalog -- 2-Tab Server & Client layout querying live database & AI recommendations

import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFormattedCatalogMovies } from "@/services/movie.service";
import { getMovieRecommendationsMap } from "@/services/recommendation.service";
import MoviesCatalogClient from "./MoviesCatalogClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Movies Catalog",
  description: "Browse now showing blockbusters and upcoming cinema premieres.",
};

export default async function MoviesPage() {
  const session = await getServerSession(authOptions);
  const { nowShowing, upcoming } = await getFormattedCatalogMovies();

  const allMovieIds = [...nowShowing.map((m) => m.id), ...upcoming.map((m) => m.id)];

  const recommendations = session?.user?.id
    ? await getMovieRecommendationsMap(session.user.id, allMovieIds)
    : {};

  return (
    <main className="flex-1 min-h-screen bg-[#03030d] text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-10 text-center space-y-3">
          <span className="inline-block text-[11px] uppercase font-bold tracking-widest text-[#a5b4fc] bg-[#2500f0]/20 border border-[#2500f0]/40 px-3.5 py-1 rounded-full">
            Complete Cinematic Schedule
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
            Film Catalog
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto">
            Select your movie to explore reserved seating layouts, screen technologies, and showtime schedules.
          </p>
        </header>

        <Suspense fallback={<div className="text-center text-zinc-500 py-12">Loading catalog...</div>}>
          <MoviesCatalogClient
            nowShowing={nowShowing}
            upcoming={upcoming}
            recommendations={recommendations}
          />
        </Suspense>
      </div>
    </main>
  );
}
```

### 11.2 Update `src/app/(customer)/movies/MoviesCatalogClient.tsx`:

```tsx
// src/app/(customer)/movies/MoviesCatalogClient.tsx
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import MovieCard from "@/components/movies/MovieCard";
import { MovieItem, RecommendationMap } from "@/types";

interface MoviesCatalogClientProps {
  nowShowing: MovieItem[];
  upcoming: MovieItem[];
  recommendations?: RecommendationMap;
}

export default function MoviesCatalogClient({
  nowShowing,
  upcoming,
  recommendations = {},
}: MoviesCatalogClientProps) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "upcoming" ? "upcoming" : "now-showing";
  const [activeTab, setActiveTab] = useState<"now-showing" | "upcoming">(initialTab);
  const [searchQuery, setSearchQuery] = useState("");

  const currentList = activeTab === "now-showing" ? nowShowing : upcoming;
  const filteredMovies = currentList.filter(
    (m) =>
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.genres.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      {/* Tab Switcher & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-[#2500f0]/20">
        {/* 2-Tab Navigation Buttons */}
        <div className="inline-flex p-1.5 rounded-2xl bg-[#070820] border border-[#2500f0]/40">
          <button
            type="button"
            onClick={() => setActiveTab("now-showing")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "now-showing"
                ? "bg-[#2500f0] text-white shadow-[0_0_15px_rgba(37,0,240,0.6)]"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>🍿 Now Showing</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 text-white/90">
              {nowShowing.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("upcoming")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "upcoming"
                ? "bg-[#2500f0] text-white shadow-[0_0_15px_rgba(37,0,240,0.6)]"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>📅 Upcoming Releases</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 text-white/90">
              {upcoming.length}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search by title or genre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-[#070820] border border-white/15 focus:border-[#5938ff] rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#5938ff]"
          />
        </div>
      </div>

      {/* Grid of Movie Cards */}
      {filteredMovies.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center space-y-2">
          <p className="text-zinc-300 font-semibold text-sm">No movies found.</p>
          <p className="text-zinc-500 text-xs">Try adjusting your search filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {filteredMovies.map((movie) => {
            const rec = recommendations[movie.id];
            return (
              <div key={movie.id} id={`movie-${movie.id}`}>
                <MovieCard
                  id={movie.id}
                  title={movie.title}
                  posterUrl={movie.posterUrl}
                  duration={movie.duration}
                  releaseDate={movie.releaseDate}
                  genres={movie.genres}
                  formats={movie.formats}
                  matchScore={rec?.matchScore}
                  matchReason={rec?.reason}
                  isUpcoming={movie.isUpcoming}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

---

## Step 12: Commit `feature/recommendation-ui` and Merge

Confirm linting passes:

```bash
npm run lint
```

Commit changes and merge into `phase/phase5-recommendations`:

```bash
git add .
git commit -m "feat(phase5): glowing in-line AI match badges and 1-sentence insights on MovieCard, Homepage, and Catalog"

# Merge into phase milestone
git checkout phase/phase5-recommendations
git merge feature/recommendation-ui

# Delete temporary feature branch
git branch -d feature/recommendation-ui
```

---

## Step 13: Verification Checkpoint

Start the development server:

```bash
npm run dev
```

Execute the verification tests:

### 1. API Endpoint Verification (`GET /api/recommendations`)
- [ ] Test unauthenticated request:
  ```bash
  curl -i http://localhost:3000/api/recommendations
  ```
  *Expected:* HTTP 200 with `{ authenticated: false, recommendations: [] }`.
- [ ] Test authenticated request: Log in via browser, inspect network tab or use session cookies with `curl`.
  *Expected:* JSON array containing `{ movieId, matchScore, reason }`.

### 2. User Taste Personalization
- [ ] Navigate to `/profile`, select specific genres (e.g. "Action", "Science Fiction"), and save.
- [ ] Visit Homepage (`/`). Confirm movies matching Action/Sci-Fi display high match scores (e.g., `🔥 92% AI Match` or higher).
- [ ] Check 1-sentence AI insights: Confirm they reference relevant genres or user preferences.

### 3. Visual UI Rendering
- [ ] In-line `🔥 {matchScore}% AI Match` badge renders in the top-right corner of movie cards with glowing accent gradient.
- [ ] 1-sentence AI insight appears cleanly under movie title/genres without overflowing.
- [ ] Badges appear seamlessly across both Homepage (`/`) and Movies Catalog (`/movies`).

### 4. Resilient Fallback Verification
- [ ] Temporarily set `GOOGLE_GEMINI_API_KEY=""` in `.env`.
- [ ] Refresh `/` and `/movies`.
- [ ] Verify pages load smoothly with heuristic match scores (no crashes, no 500 errors).
- [ ] Restore `GOOGLE_GEMINI_API_KEY` in `.env`.

---

## Step 14: Merge `phase/phase5-recommendations` into `develop`

Once all verification steps pass, merge the milestone into `develop` and push to remote:

```bash
git checkout develop
git merge phase/phase5-recommendations

# Push both branches (preserve phase branch on GitHub -- NEVER delete)
git push origin develop
git push origin phase/phase5-recommendations
```

---

## Phase 5 Complete — Summary

| Deliverable | Status |
|:---|:---|
| `@google/genai` SDK installed | Ready |
| `src/lib/gemini.ts` client singleton with fallback | Ready |
| `src/types/index.ts` recommendation types | Ready |
| `src/services/recommendation.service.ts` domain service | Ready |
| `GET /api/recommendations` Route Handler | Ready |
| `MovieCard.tsx` glowing in-line `🔥 {matchScore}% AI Match` badges & insights | Ready |
| Homepage (`/`) personalized recommendation integration | Ready |
| Movies Catalog (`/movies`) personalized recommendation integration | Ready |
| Resilient heuristic fallback against network/quota limits | Ready |
| `feature/gemini-service` -> `phase/phase5-recommendations` | Merged & deleted |
| `feature/recommendation-ui` -> `phase/phase5-recommendations` | Merged & deleted |
| `phase/phase5-recommendations` -> `develop` | Merged & preserved |

**Next up:** Phase 6 — Interactive Seat Map, Dynamic Pricing & SWR Polling (`phase/phase6-seatmap`)
