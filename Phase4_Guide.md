# Phase 4: Step-by-Step Implementation Guide

**Goal:** Build the dynamic Homepage (`/`) as a Next.js Server Component querying live PostgreSQL movie data, the 2-Tab Movies Catalog page (`/movies`), the Experiences FYI page (`/experiences`), and the Profile Settings page (`/profile`) with multi-select genre preference management.

**Source of truth:** `CiniGo_Phase_Plan.md` lines 102–129 | `CiniGo_Scope.md` Sections 2.1, 4.1, 5 (FR-03, FR-04)

---

## Overview — What We Build in Phase 4

```
phase/phase4-movies
   ├── feature/homepage-catalog    (Server Component Homepage, live DB queries, MovieCard, HeroSpotlight, /movies 2-tab catalog)
   └── feature/experiences-profile (Experiences 4-format showcase, /profile page, GET/POST /api/user/interests endpoint)
```

### Key Deliverables:
- `prisma/seed.ts` (updated) — Seed active/future showtimes so the "Now Showing" derived query returns real showtime schedules
- `src/types/index.ts` — TypeScript types (`MovieWithRelations`, `MovieCardProps`, `GenreWithSelection`)
- `src/services/movie.service.ts` — Reusable data access service layer querying "Now Showing" and "Upcoming Releases"
- `src/services/user.service.ts` — Reusable user profile and genre preferences service layer (`getUserProfile`, `getGenresWithUserSelection`, `updateUserInterests`, `getUserFavoriteGenres`)
- `src/components/movies/MovieCard.tsx` — Modular, clickable movie card with poster, formats, runtime, and in-line AI match badge slot
- `src/components/movies/HeroSpotlight.tsx` — Interactive Client Component for hero carousel controls & backdrop transitions
- `src/app/page.tsx` — Server Component Homepage fetching "Now Showing" and "Upcoming Releases" live from PostgreSQL via `movie.service.ts`
- `src/app/(customer)/movies/page.tsx` — Movies Catalog page with a clean 2-tab layout: `[ 🍿 Now Showing ]` vs `[ 📅 Upcoming Releases ]`
- `src/app/experiences/page.tsx` & `ExperiencesClient.tsx` — Experiences FYI showcase covering 4 flagship formats + 4 global benchmarks with interactive category tabs and search
- `src/app/api/user/interests/route.ts` — Lightweight API endpoints (`GET` and `POST`) calling `user.service.ts`
- `src/app/(customer)/profile/page.tsx` & `ProfileClient.tsx` — Account settings page with member details & interactive multi-select genre tag selector consuming `user.service.ts`

---

## Step 1: Git Branching Setup

Ensure your local `develop` branch is clean and up to date, then branch the permanent phase milestone and the first feature branch:

```bash
# Checkout develop and ensure it is synced
git checkout develop
git pull origin develop

# Create the permanent milestone branch
git checkout -b phase/phase4-movies
git push origin phase/phase4-movies

# Create the first feature branch
git checkout -b feature/homepage-catalog
```

Your branch hierarchy is now:
```
main
develop
  └── phase/phase4-movies          <-- Permanent Phase Milestone (NEVER delete)
        └── feature/homepage-catalog  <-- You are HERE
```

---

## Step 2: Seed Active Showtimes (`prisma/seed.ts`)

### Why This Is Required
In `CiniGo_Scope.md` (FR-03) and `CiniGo_Phase_Plan.md`, movie status is **derived dynamically at query time**:
- **Now Showing**: `releaseDate <= today AND showtimes.some(startsAt >= today)`
- **Upcoming Releases**: `releaseDate > today`

The initial seed created movies with past release dates but did not insert any `Showtime` records. Without showtimes scheduled for today or later, the "Now Showing" query returns an empty list.

Update `prisma/seed.ts` to attach future showtimes to the released movies:

```typescript
// prisma/seed.ts
// Add this block after step 5 (movie creation) and before step 6 (admin user creation):

  // ── 5.1 Conflict-Free Cinema Scheduling for Released Movies ──
  console.log('\n🎟️  Scheduling conflict-free active showtimes for released movies...');
  const releasedTitles = [
    'Deadpool & Wolverine',
    'Gladiator II',
    'Wicked',
    'The Wild Robot',
    'Captain America: Brave New World',
  ];

  const releasedMovies = await prisma.movie.findMany({
    where: { title: { in: releasedTitles } },
  });

  // Turnaround & cleaning buffer between screenings (minutes)
  const CLEANING_BUFFER_MINUTES = 25;

  let totalShowtimes = 0;

  // Schedule across 3 days (today, tomorrow, day after tomorrow)
  for (let dayOffset = 0; dayOffset <= 2; dayOffset++) {
    for (let screenIndex = 0; screenIndex < screens.length; screenIndex++) {
      const screen = screens[screenIndex];

      // Screen opens at 11:00 AM each day
      const currentTime = new Date();
      currentTime.setDate(currentTime.getDate() + dayOffset);
      currentTime.setHours(11, 0, 0, 0);

      // Closing limit: last show must start before 22:30
      const closingTime = new Date(currentTime);
      closingTime.setHours(22, 30, 0, 0);

      // Stagger starting movie across screens and days to ensure balanced programming
      let movieIndex = (screenIndex + dayOffset) % releasedMovies.length;

      while (currentTime < closingTime) {
        const movie = releasedMovies[movieIndex];
        const startsAt = new Date(currentTime);
        const endsAt = new Date(startsAt.getTime() + movie.duration * 60 * 1000);

        await prisma.showtime.create({
          data: {
            movieId: movie.id,
            screenId: screen.id,
            startsAt,
            endsAt,
          },
        });
        totalShowtimes++;

        // Next screening starts after movie duration + cleaning buffer
        currentTime.setTime(endsAt.getTime() + CLEANING_BUFFER_MINUTES * 60 * 1000);

        // Round up to nearest 5 minutes for clean cinema schedule intervals (e.g. 13:43 -> 13:45)
        const remainderMinutes = currentTime.getMinutes() % 5;
        if (remainderMinutes !== 0) {
          currentTime.setMinutes(currentTime.getMinutes() + (5 - remainderMinutes));
        }

        // Cycle to next movie for this screen
        movieIndex = (movieIndex + 1) % releasedMovies.length;
      }
    }
  }
  console.log(`✅ Created ${totalShowtimes} conflict-free showtimes across ${screens.length} screens.`);

  // Automated Conflict Verification Assertion
  const allShowtimes = await prisma.showtime.findMany({
    orderBy: [{ screenId: 'asc' }, { startsAt: 'asc' }],
  });

  let conflictCount = 0;
  for (let i = 0; i < allShowtimes.length - 1; i++) {
    const current = allShowtimes[i];
    const next = allShowtimes[i + 1];
    if (current.screenId === next.screenId && current.endsAt > next.startsAt) {
      console.error(
        `❌ Overlap detected on screen ${current.screenId}: [${current.startsAt.toLocaleTimeString()} - ${current.endsAt.toLocaleTimeString()}] overlaps with [${next.startsAt.toLocaleTimeString()} - ${next.endsAt.toLocaleTimeString()}]`
      );
      conflictCount++;
    }
  }

  if (conflictCount === 0) {
    console.log('🛡️  Verified: 0 showtime conflicts detected across all screens!\n');
  } else {
    throw new Error(`Scheduling conflict check failed: ${conflictCount} overlapping showtimes found.`);
  }
```

Re-run the database seed:

```bash
npx prisma db seed
```

---

## Step 3: TypeScript Definitions (`src/types/index.ts`)

Update `src/types/index.ts` to export standard types for movies, relations, and card components across Phase 4 and Phase 5:

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
```

---

## Step 4: Reusable Movie Card Component (`src/components/movies/MovieCard.tsx`)

Create `src/components/movies/MovieCard.tsx`. This component conforms to the **Electric Luxe Cinema Dark Theme**, provides smooth hover scaling, optical image constraints, format badges, and an integrated placeholder for Phase 5 AI match badges.

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

          {matchScore && (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-[#2500f0]/90 text-white border border-[#5938ff]/80 shadow-[0_0_12px_rgba(37,0,240,0.8)] backdrop-blur-md animate-pulse">
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
      <div className="p-3.5 flex flex-col flex-1 justify-between gap-2 bg-[#06071e]/90">
        <div>
          <h3 className="text-sm font-bold text-white group-hover:text-[#c7d2fe] transition-colors line-clamp-1">
            {title}
          </h3>
          <p className="text-[11px] text-zinc-400 font-medium line-clamp-1 mt-0.5">
            {genres.slice(0, 2).join(" · ")}
          </p>
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

## Step 5: Interactive Hero Spotlight Component (`src/components/movies/HeroSpotlight.tsx`)

The Homepage requires a featured blockbuster hero. To keep the homepage a fast Server Component while retaining fluid carousel interactivity, extract the interactive controls into `src/components/movies/HeroSpotlight.tsx`.

```tsx
// src/components/movies/HeroSpotlight.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatDuration } from "@/lib/utils";

interface SpotlightMovie {
  id: string;
  title: string;
  description: string;
  backdropUrl: string;
  posterUrl: string;
  duration: number;
  genres: string[];
  formats: string[];
}

interface HeroSpotlightProps {
  movies: SpotlightMovie[];
}

export default function HeroSpotlight({ movies }: HeroSpotlightProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (movies.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % movies.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [movies.length]);

  if (!movies || movies.length === 0) return null;
  const current = movies[activeIndex];

  return (
    <section className="relative w-full min-h-[520px] lg:min-h-[640px] flex items-center overflow-hidden border-b border-[#2500f0]/30">
      {/* Background Backdrops with crossfade */}
      {movies.map((m, idx) => (
        <div
          key={m.id}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            idx === activeIndex ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <Image
            src={m.backdropUrl}
            alt={m.title}
            fill
            priority={idx === 0}
            className="object-cover object-center scale-105"
          />
          {/* Dynamic multi-stop lighting vignette */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#03030d] via-[#03030d]/85 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#03030d] via-transparent to-[#03030d]/60" />
        </div>
      ))}

      {/* Atmospheric Ambient Glow */}
      <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-[#2500f0]/30 rounded-full blur-[140px] pointer-events-none" />

      {/* Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
        <div className="max-w-2xl space-y-5">
          {/* Formats & Tags */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase font-black tracking-widest px-3 py-1 rounded-full bg-[#2500f0]/80 text-white border border-[#5938ff] shadow-[0_0_16px_rgba(37,0,240,0.6)]">
              Featured Premiere
            </span>
            {current.formats.map((fmt) => (
              <span
                key={fmt}
                className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-white/[0.08] text-[#c7d2fe] border border-white/15 backdrop-blur-md"
              >
                {fmt}
              </span>
            ))}
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight uppercase leading-none drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
            {current.title}
          </h1>

          {/* Metadata Row */}
          <div className="flex items-center gap-4 text-xs font-semibold text-[#c7d2fe]">
            <span>{formatDuration(current.duration)}</span>
            <span>•</span>
            <span>{current.genres.join(" / ")}</span>
            <span>•</span>
            <span className="text-emerald-400 font-bold">Now Showing</span>
          </div>

          {/* Description Hook */}
          <p className="text-xs sm:text-sm text-zinc-300 line-clamp-3 leading-relaxed max-w-xl">
            {current.description}
          </p>

          {/* Call-to-Action Buttons */}
          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <Link
              href={`/movies#movie-${current.id}`}
              className="btn-cobalt text-xs font-black uppercase tracking-wider px-6 py-3 rounded-xl flex items-center gap-2"
            >
              <span>Reserve Seats</span>
              <span>→</span>
            </Link>
            <Link
              href="/experiences"
              className="text-xs font-bold text-white px-5 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 transition-all"
            >
              Explore Screen Formats
            </Link>
          </div>

          {/* Slide Indicator Dots */}
          {movies.length > 1 && (
            <div className="flex items-center gap-2 pt-4">
              {movies.map((m, idx) => (
                <button
                  key={m.id}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === activeIndex
                      ? "w-8 bg-[#5938ff] shadow-[0_0_10px_rgba(89,56,255,0.8)]"
                      : "w-2 bg-white/30 hover:bg-white/60"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
```

---

## Step 6: Refactor Homepage as a Server Component (`src/app/page.tsx`)

Replace the static mock in `src/app/page.tsx` with a **Server Component** fetching live data directly from PostgreSQL via Prisma.

```tsx
// src/app/page.tsx
// CineGo Homepage -- Server Component querying live PostgreSQL database

import Link from "next/link";
import prisma from "@/lib/prisma";
import HeroSpotlight from "@/components/movies/HeroSpotlight";
import MovieCard from "@/components/movies/MovieCard";

// Dynamic rendering to ensure showtimes and releases are always evaluated at request time
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const now = new Date();

  // 1. Query "Now Showing" Movies (released AND has at least one active future showtime)
  const nowShowingRaw = await prisma.movie.findMany({
    where: {
      releaseDate: { lte: now },
      showtimes: {
        some: {
          startsAt: { gte: now },
        },
      },
    },
    include: {
      genres: {
        include: { genre: true },
      },
      showtimes: {
        where: { startsAt: { gte: now } },
        include: { screen: true },
        take: 5,
      },
    },
    orderBy: { releaseDate: "desc" },
    take: 5,
  });

  // 2. Query "Upcoming Releases" (releaseDate is in the future)
  const upcomingRaw = await prisma.movie.findMany({
    where: {
      releaseDate: { gt: now },
    },
    include: {
      genres: {
        include: { genre: true },
      },
    },
    orderBy: { releaseDate: "asc" },
    take: 5,
  });

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
              {upcomingRaw.map((movie) => (
                <MovieCard
                  key={movie.id}
                  id={movie.id}
                  title={movie.title}
                  posterUrl={movie.posterUrl}
                  duration={movie.duration}
                  releaseDate={movie.releaseDate}
                  genres={movie.genres.map((g) => g.genre.name)}
                  isUpcoming={true}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
```

---

## Step 7: Build Movies Catalog Page (`src/app/(customer)/movies/page.tsx`)

Create the 2-Tab Movies Catalog at `src/app/(customer)/movies/page.tsx`. This page queries the complete catalog of movies, categorizes them according to the same derived query rules, and renders a clean tabbed UI (`[ 🍿 Now Showing ]` vs `[ 📅 Upcoming Releases ]`).

```tsx
// src/app/(customer)/movies/page.tsx
// Movies Catalog -- 2-Tab Server & Client layout querying live database

import prisma from "@/lib/prisma";
import MoviesCatalogClient from "./MoviesCatalogClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Movies Catalog",
  description: "Browse now showing blockbusters and upcoming cinema premieres.",
};

export default async function MoviesPage() {
  const now = new Date();

  // 1. Fetch All "Now Showing" (released with active showtime)
  const nowShowing = await prisma.movie.findMany({
    where: {
      releaseDate: { lte: now },
      showtimes: {
        some: {
          startsAt: { gte: now },
        },
      },
    },
    include: {
      genres: { include: { genre: true } },
      showtimes: {
        where: { startsAt: { gte: now } },
        include: { screen: true },
      },
    },
    orderBy: { releaseDate: "desc" },
  });

  // 2. Fetch All "Upcoming Releases"
  const upcoming = await prisma.movie.findMany({
    where: {
      releaseDate: { gt: now },
    },
    include: {
      genres: { include: { genre: true } },
    },
    orderBy: { releaseDate: "asc" },
  });

  // Format data for client view
  const formattedNowShowing = nowShowing.map((m) => {
    const screens = m.showtimes.map((s) => s.screen.name);
    return {
      id: m.id,
      title: m.title,
      description: m.description,
      posterUrl: m.posterUrl,
      duration: m.duration,
      releaseDate: m.releaseDate.toISOString(),
      genres: m.genres.map((g) => g.genre.name),
      formats: Array.from(new Set(screens)),
      isUpcoming: false,
    };
  });

  const formattedUpcoming = upcoming.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    posterUrl: m.posterUrl,
    duration: m.duration,
    releaseDate: m.releaseDate.toISOString(),
    genres: m.genres.map((g) => g.genre.name),
    formats: ["Digital 4K"],
    isUpcoming: true,
  }));

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

        <MoviesCatalogClient
          nowShowing={formattedNowShowing}
          upcoming={formattedUpcoming}
        />
      </div>
    </main>
  );
}
```

Now create the interactive client tab switcher in `src/app/(customer)/movies/MoviesCatalogClient.tsx`:

```tsx
// src/app/(customer)/movies/MoviesCatalogClient.tsx
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import MovieCard from "@/components/movies/MovieCard";

interface MovieItem {
  id: string;
  title: string;
  description: string;
  posterUrl: string;
  duration: number;
  releaseDate: string;
  genres: string[];
  formats: string[];
  isUpcoming: boolean;
}

interface MoviesCatalogClientProps {
  nowShowing: MovieItem[];
  upcoming: MovieItem[];
}

export default function MoviesCatalogClient({
  nowShowing,
  upcoming,
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
          {filteredMovies.map((movie) => (
            <div key={movie.id} id={`movie-${movie.id}`}>
              <MovieCard
                id={movie.id}
                title={movie.title}
                posterUrl={movie.posterUrl}
                duration={movie.duration}
                releaseDate={movie.releaseDate}
                genres={movie.genres}
                formats={movie.formats}
                isUpcoming={movie.isUpcoming}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Step 8: Commit `feature/homepage-catalog` and Merge

Run a quick build or lint test to confirm zero compile errors:

```bash
npm run lint
```

Then commit and merge back into `phase/phase4-movies`:

```bash
git add .
git commit -m "feat(phase4): server component homepage, live queries, movie card and 2-tab catalog"

# Merge into phase milestone
git checkout phase/phase4-movies
git merge feature/homepage-catalog

# Delete temporary feature branch
git branch -d feature/homepage-catalog
```

---

## Step 9: Git Branch `feature/experiences-profile`

Create the second feature branch for the Experiences and Profile sections:

```bash
git checkout -b feature/experiences-profile
```

---

## Step 10: Complete Experiences Showcase (`src/app/experiences/page.tsx` & `ExperiencesClient.tsx`)

Update the experiences showcase to feature **4 CineGo Flagship formats** (IMAX® with Laser, Dolby Cinema & Atmos®, 4DX Motion & Effects, The Director's Lounge VIP) plus **4 Global Cinema Benchmarks** (ScreenX®, Samsung Onyx® Cinema LED, THX® Ultimate Cinema, D-BOX® Haptic Motion), complete with interactive category filtering, live tech search, and zero duplicate header bar:

### 10.1 Server Component Container (`src/app/experiences/page.tsx`)

```tsx
// src/app/experiences/page.tsx
// CineGo Experiences FYI Showcase -- Flagship Formats & Global Cinema Technology Standards

import ExperiencesClient from "./ExperiencesClient";

export const metadata = {
  title: "Auditorium Experiences",
  description: "Explore CineGo cutting-edge cinema screen formats and audio technologies.",
};

export default function ExperiencesPage() {
  return (
    <main className="flex-1 flex flex-col min-h-screen bg-[#03030d] text-white py-12">
      {/* Hero Banner */}
      <section className="relative py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center space-y-4">
        <div className="inline-flex items-center gap-2 glass-chip text-white text-xs font-bold px-4 py-1.5 rounded-full border border-[#2500f0]/50">
          <span className="w-2 h-2 rounded-full bg-[#2500f0] animate-ping" />
          The CineGo Precision Standards
        </div>
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight uppercase drop-shadow-[0_4px_30px_rgba(37,0,240,0.6)]">
          Engineered For Pure Immersion
        </h1>
        <p className="text-xs sm:text-sm text-[#c7d2fe] max-w-2xl mx-auto leading-relaxed">
          Not all screens are created equal. Discover how our custom calibrated laser projection, 
          spatial acoustics, and VIP hospitality redefine modern cinema.
        </p>
      </section>

      {/* Experience Showcase Cards & Interactive Filter */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 w-full">
        <ExperiencesClient />
      </section>
    </main>
  );
}
```

### 10.2 Interactive Client Filter & Standards Grid (`src/app/experiences/ExperiencesClient.tsx`)

```tsx
// src/app/experiences/ExperiencesClient.tsx
"use client";

import { useState } from "react";

export interface AuditoriumSpec {
  id: string;
  name: string;
  category: "flagship" | "vip" | "global";
  badge: string;
  spec: string;
  desc: string;
  features: string[];
  highlight: string;
  availability: string;
}

export const AUDITORIUM_SPECS: AuditoriumSpec[] = [
  {
    id: "imax",
    name: "IMAX® with Laser",
    category: "flagship",
    badge: "Maximum Immersion",
    spec: "Dual 4K Laser Projection · 1.43:1 Expanded Aspect Ratio",
    desc: "Experience up to 40% more picture with unparalleled laser sharpness and a custom 12-channel soundstage tuned for visceral physical resonance.",
    features: [
      "Next-Gen 4K Laser Optical Engine",
      "Sub-bass Transducers in Every Seat",
      "Floor-to-Ceiling Curved Canvas",
      "Laser-Aligned Digital Audio",
    ],
    highlight: "Best for Sci-Fi blockbusters and cinematic epics",
    availability: "Flagship Hall 1",
  },
  {
    id: "dolby",
    name: "Dolby Cinema & Atmos®",
    category: "flagship",
    badge: "Acoustic & Visual Mastery",
    spec: "64-Channel Spatial Audio · Dolby Vision Dual 4K HDR",
    desc: "Individual sound elements flow dynamically above and around you with true obsidian blacks and a 1,000,000:1 dynamic contrast ratio.",
    features: [
      "Object-Based Spatial Sound Elements",
      "Dual 4K Christie Laser Projectors",
      "Zero-Spill Matte Black Interior",
      "Dolby Vision High Dynamic Range",
    ],
    highlight: "Best for acoustic mastery and dramatic contrast",
    availability: "Flagship Hall 2",
  },
  {
    id: "4dx",
    name: "4DX Motion & Effects",
    category: "flagship",
    badge: "Sensory Immersion",
    spec: "Synchronized Motion Seats · Atmospheric FX",
    desc: "Step beyond the screen with active motion seats synchronized with on-screen action, wind turbulence, water mist, scents, and strobe flashes.",
    features: [
      "3-DOF Hydraulic Motion Simulators",
      "In-Theater Wind & Rain Simulators",
      "Dynamic Environmental Scent Delivery",
      "Lightning & Fog Simulation Systems",
    ],
    highlight: "Best for high-octane action and thrillers",
    availability: "Flagship Hall 3",
  },
  {
    id: "vip",
    name: "The Director's Lounge",
    category: "vip",
    badge: "VIP Hospitality",
    spec: "Motorized Zero-Gravity Recliners · In-Seat Dining",
    desc: "Curated for uncompromising luxury. Enjoy in-theatre artisanal dining and handcrafted refreshments delivered silently to your personal private pod.",
    features: [
      "Heated Italian Leather Recliners",
      "Acoustic Privacy Isolation Pods",
      "Call-Button At-Seat Waiter Service",
      "Artisanal Dining & Champagne Menu",
    ],
    highlight: "Best for romantic dates and luxury relaxation",
    availability: "Private Suites & Lounge",
  },
  {
    id: "screenx",
    name: "ScreenX® 270° Panoramic",
    category: "global",
    badge: "270° Panoramic Canvas",
    spec: "Multi-Projection Array · 270° Triple-Wall Immersion",
    desc: "Expands cinematic storytelling beyond the traditional frame by utilizing the left and right auditorium walls, surrounding your peripheral vision with visual action.",
    features: [
      "Multi-Array Laser Projector Blending",
      "Proprietary Panoramic Color Alignment",
      "Active Side-Wall Scene Extension",
      "Synchronized Spatial Surround Tuning",
    ],
    highlight: "Best for aerial sequences, speed chases, and wide spectacles",
    availability: "Global Benchmark",
  },
  {
    id: "onyx",
    name: "Samsung Onyx® Cinema LED",
    category: "global",
    badge: "Direct-View Quantum LED",
    spec: "4K DCI-Compliant Active LED · True Infinite Contrast",
    desc: "Eliminates traditional projection entirely with self-illuminating cinema LED modules. Delivers true 0-nit obsidian blacks, 300 nits peak HDR brightness, and distortion-free geometry.",
    features: [
      "100% DCI-P3 Color Accuracy",
      "Infinite Contrast Ratio (0.0005 to 300+ nits)",
      "Meyer Sound / JBL Sculpted Audio Array",
      "Active 3D Without Dimming or Crosstalk",
    ],
    highlight: "Best for ultra-sharp HDR visual masterpieces",
    availability: "Global Benchmark",
  },
  {
    id: "thx",
    name: "THX® Ultimate Cinema",
    category: "global",
    badge: "Studio Audio Reference",
    spec: "NC-30 Acoustic Isolation · Dual 4K Laser Projection",
    desc: "The legendary acoustic standard founded by George Lucas. Every architectural baffle, acoustic dampening panel, and speaker crossover is calibrated to match Hollywood studio dubbing stages.",
    features: [
      "NC-30 Architectural Noise Criterion",
      "Precision RT60 Reverberation Tuning",
      "Floating Wall Acoustic Isolation",
      "Baffle-Mounted Sub-Bass Line Arrays",
    ],
    highlight: "Best for audiophiles and master orchestral scores",
    availability: "Global Benchmark",
  },
  {
    id: "dbox",
    name: "D-BOX® Haptic Motion",
    category: "global",
    badge: "Micro-Telemetry Haptics",
    spec: "Sub-Millimeter Actuators · Studio-Coded Telemetry",
    desc: "Hollywood studio directors program frame-by-frame motion code into the film, transmitting true physical G-forces, subtle engine vibrations, and spatial pitch directly through the seat.",
    features: [
      "Sub-Millimeter Precision Actuators",
      "Studio Direct Telemetry Encoding",
      "Pitch, Roll & Heave Motion Dynamics",
      "Individual Intensity Controller",
    ],
    highlight: "Best for racing films, flight sims, and visceral action",
    availability: "Global Benchmark",
  },
];

export default function ExperiencesClient() {
  const [activeTab, setActiveTab] = useState<"all" | "flagship" | "global">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSpecs = AUDITORIUM_SPECS.filter((spec) => {
    const matchesTab =
      activeTab === "all"
        ? true
        : activeTab === "flagship"
        ? spec.category === "flagship" || spec.category === "vip"
        : spec.category === "global";

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      spec.name.toLowerCase().includes(q) ||
      spec.spec.toLowerCase().includes(q) ||
      spec.badge.toLowerCase().includes(q) ||
      spec.features.some((f) => f.toLowerCase().includes(q));

    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-10">
      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-[#2500f0]/20">
        <div className="inline-flex p-1.5 rounded-2xl bg-[#070820] border border-[#2500f0]/40">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "all"
                ? "bg-[#2500f0] text-white shadow-[0_0_15px_rgba(37,0,240,0.6)]"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>All Standards</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 text-white/90">
              {AUDITORIUM_SPECS.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("flagship")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "flagship"
                ? "bg-[#2500f0] text-white shadow-[0_0_15px_rgba(37,0,240,0.6)]"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>🍿 CineGo Flagship</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 text-white/90">
              4
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("global")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "global"
                ? "bg-[#2500f0] text-white shadow-[0_0_15px_rgba(37,0,240,0.6)]"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>🌐 Global Showcase</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 text-white/90">
              4
            </span>
          </button>
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search technology, audio, or display..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-[#070820] border border-white/15 focus:border-[#5938ff] rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#5938ff]"
          />
        </div>
      </div>

      {/* Experience Showcase Cards */}
      {filteredSpecs.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center space-y-2">
          <p className="text-zinc-300 font-semibold text-sm">No cinema standards found.</p>
          <p className="text-zinc-500 text-xs">Try adjusting your search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSpecs.map((spec) => (
            <div
              key={spec.id}
              className="glass-panel-cobalt rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 relative overflow-hidden group hover:border-[#5938ff] transition-all duration-300 shadow-xl"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[10px] sm:text-[11px] uppercase font-black tracking-widest text-[#a5b4fc] bg-[#2500f0]/30 border border-[#2500f0]/50 px-3 py-1 rounded-full">
                    {spec.badge}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/[0.06] text-zinc-300 border border-white/10">
                    {spec.availability}
                  </span>
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{spec.name}</h2>
                  <div className="mt-2 text-[11px] sm:text-xs font-mono font-bold text-[#c7d2fe] bg-black/40 p-2.5 rounded-xl border border-white/10">
                    {spec.spec}
                  </div>
                </div>

                <p className="text-xs text-[#e2e8f0] leading-relaxed">{spec.desc}</p>

                <div className="space-y-2 pt-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                    Key Specifications
                  </div>
                  <ul className="space-y-1.5">
                    {spec.features.map((feat) => (
                      <li key={feat} className="text-xs text-[#c7d2fe] flex items-center gap-2">
                        <span className="text-[#5938ff] font-bold">✓</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-[#c7d2fe]/90 italic">
                  🎯 {spec.highlight}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Step 11: Reusable User Service & Interests API Endpoint

### Architectural Principle: Service Layer Pattern
Following **Clean Architecture** and matching `src/services/movie.service.ts`:
- We do **not** write raw database queries directly inside Server Components or Route Handlers.
- All user profile, genre mapping, and transaction logic is placed in `src/services/user.service.ts`.
- This makes database operations reusable across Server Components (`/profile`), API Route Handlers (`/api/user/interests`), and **Phase 5 AI Recommendation Services** (`recommendation.service.ts`), while keeping routes and views focused on transport and presentation.

### 11.1 Create Reusable User Data Access Service (`src/services/user.service.ts`)

Create `src/services/user.service.ts`:

```typescript
// src/services/user.service.ts
// CineGo -- Reusable User & Genre Preferences Service Layer

import prisma from "@/lib/prisma";

export interface GenreSelectionItem {
  id: string;
  name: string;
  selected: boolean;
}

/**
 * Fetch member profile details along with currently selected genre IDs.
 */
export async function getUserProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      interests: {
        select: { genreId: true },
      },
    },
  });
}

/**
 * Fetch all available genres sorted alphabetically with a boolean flag indicating if the user has selected it.
 */
export async function getGenresWithUserSelection(userId?: string): Promise<GenreSelectionItem[]> {
  const [allGenres, userInterests] = await Promise.all([
    prisma.genre.findMany({ orderBy: { name: "asc" } }),
    userId
      ? prisma.userInterest.findMany({
          where: { userId },
          select: { genreId: true },
        })
      : Promise.resolve([]),
  ]);

  const selectedSet = new Set(userInterests.map((ui) => ui.genreId));

  return allGenres.map((genre) => ({
    id: genre.id,
    name: genre.name,
    selected: selectedSet.has(genre.id),
  }));
}

/**
 * Atomically update user genre selections inside a Prisma transaction.
 */
export async function updateUserInterests(userId: string, genreIds: string[]) {
  return prisma.$transaction(async (tx) => {
    // 1. Delete previous selections
    await tx.userInterest.deleteMany({
      where: { userId },
    });

    // 2. Insert new selections
    if (genreIds.length > 0) {
      await tx.userInterest.createMany({
        data: genreIds.map((genreId: string) => ({
          userId,
          genreId,
        })),
      });
    }

    return { count: genreIds.length };
  });
}

/**
 * Fetch favorite genre names for a user (used by Phase 5 AI Gemini Recommendation Engine).
 */
export async function getUserFavoriteGenres(userId: string): Promise<string[]> {
  const interests = await prisma.userInterest.findMany({
    where: { userId },
    include: { genre: true },
  });

  return interests.map((i) => i.genre.name);
}
```

### 11.2 Lightweight Route Handler (`src/app/api/user/interests/route.ts`)

Create `src/app/api/user/interests/route.ts` calling `user.service.ts`:

```typescript
// src/app/api/user/interests/route.ts
// Lightweight Next.js Route Handler delegating to user.service.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getGenresWithUserSelection,
  updateUserInterests,
} from "@/services/user.service";

// GET /api/user/interests
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await getGenresWithUserSelection(session.user.id);
    return NextResponse.json({ genres: items });
  } catch (error) {
    console.error("Error fetching user genres:", error);
    return NextResponse.json(
      { error: "Failed to fetch genre preferences" },
      { status: 500 }
    );
  }
}

// POST /api/user/interests
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { genreIds } = body;

    if (!Array.isArray(genreIds)) {
      return NextResponse.json(
        { error: "genreIds must be an array of strings" },
        { status: 400 }
      );
    }

    const result = await updateUserInterests(session.user.id, genreIds);
    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("Error updating user interests:", error);
    return NextResponse.json(
      { error: "Failed to update genre preferences" },
      { status: 500 }
    );
  }
}
```

---

## Step 12: Build Profile Settings Page (`src/app/(customer)/profile/page.tsx`)

Create the customer profile view in `src/app/(customer)/profile/page.tsx`. This page is protected by `src/middleware.ts` (redirects to `/login` if unauthenticated).

```tsx
// src/app/(customer)/profile/page.tsx
// Profile & Genre Preferences page -- Clean Server Component querying user.service.ts

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserProfile, getGenresWithUserSelection } from "@/services/user.service";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profile & Preferences",
  description: "Manage your CineGo account and favorite genres for AI recommendations.",
};

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/profile");
  }

  const [user, genresWithSelection] = await Promise.all([
    getUserProfile(session.user.id),
    getGenresWithUserSelection(session.user.id),
  ]);

  if (!user) {
    redirect("/login");
  }

  const selectedGenreIds = user.interests.map((i) => i.genreId);
  const allGenres = genresWithSelection.map((g) => ({ id: g.id, name: g.name }));

  return (
    <main className="flex-1 min-h-screen bg-[#03030d] text-white py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <ProfileClient
          user={{
            id: user.id,
            email: user.email,
            name: user.name || "Cinema Enthusiast",
            role: user.role,
            createdAt: user.createdAt.toISOString(),
          }}
          allGenres={allGenres}
          initialSelectedGenreIds={selectedGenreIds}
        />
      </div>
    </main>
  );
}
```

Now create the interactive client form in `src/app/(customer)/profile/ProfileClient.tsx`:

```tsx
// src/app/(customer)/profile/ProfileClient.tsx
"use client";

import { useState } from "react";

interface GenreItem {
  id: string;
  name: string;
}

interface ProfileClientProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: string;
  };
  allGenres: GenreItem[];
  initialSelectedGenreIds: string[];
}

export default function ProfileClient({
  user,
  allGenres,
  initialSelectedGenreIds,
}: ProfileClientProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedGenreIds);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const toggleGenre = (genreId: string) => {
    setSelectedIds((prev) =>
      prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/user/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genreIds: selectedIds }),
      });

      if (!res.ok) throw new Error("Failed to save preferences");

      setStatusMessage({
        type: "success",
        text: "Preferences saved successfully! AI will use these to match movies.",
      });
    } catch {
      setStatusMessage({
        type: "error",
        text: "Unable to save preferences. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const formattedJoinDate = new Date(user.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
          Account &amp; Preferences
        </h1>
        <p className="text-xs sm:text-sm text-[#c7d2fe] mt-1">
          Customize your profile and genre tastes to power AI recommendation match scores.
        </p>
      </div>

      {/* Account Info Card */}
      <div className="glass-panel-cobalt rounded-2xl p-6 sm:p-7 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#a5b4fc]">
          Member Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="bg-black/40 p-3.5 rounded-xl border border-white/10">
            <span className="text-zinc-400 block text-[11px] mb-1">Display Name</span>
            <span className="font-bold text-white text-sm">{user.name}</span>
          </div>

          <div className="bg-black/40 p-3.5 rounded-xl border border-white/10">
            <span className="text-zinc-400 block text-[11px] mb-1">Email Address</span>
            <span className="font-bold text-white text-sm truncate block">{user.email}</span>
          </div>

          <div className="bg-black/40 p-3.5 rounded-xl border border-white/10">
            <span className="text-zinc-400 block text-[11px] mb-1">Membership Role</span>
            <span className="font-bold text-emerald-400 uppercase tracking-wider text-xs">
              {user.role}
            </span>
          </div>

          <div className="bg-black/40 p-3.5 rounded-xl border border-white/10">
            <span className="text-zinc-400 block text-[11px] mb-1">Member Since</span>
            <span className="font-bold text-white text-xs">{formattedJoinDate}</span>
          </div>
        </div>
      </div>

      {/* Genre Preferences Selection Card */}
      <div className="glass-panel-cobalt rounded-2xl p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#a5b4fc] flex items-center gap-2">
              <span>Favorite Movie Genres</span>
              <span className="text-[11px] text-amber-400 font-semibold lowercase">
                (powers Phase 5 AI engine)
              </span>
            </h2>
            <p className="text-xs text-zinc-300 mt-0.5">
              Click genres you love. Selected: {selectedIds.length}
            </p>
          </div>
        </div>

        {/* Multi-Select Pills Grid */}
        <div className="flex flex-wrap gap-2.5 pt-2">
          {allGenres.map((genre) => {
            const isSelected = selectedIds.includes(genre.id);
            return (
              <button
                key={genre.id}
                type="button"
                onClick={() => toggleGenre(genre.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? "bg-[#2500f0] text-white border border-[#5938ff] shadow-[0_0_12px_rgba(37,0,240,0.6)] scale-105"
                    : "bg-[#070820] text-zinc-400 border border-white/15 hover:border-white/30 hover:text-white"
                }`}
              >
                <span>{isSelected ? "✓" : "+"}</span>
                <span>{genre.name}</span>
              </button>
            );
          })}
        </div>

        {/* Feedback alert */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold ${
              statusMessage.type === "success"
                ? "bg-emerald-950/80 text-emerald-200 border border-emerald-500/40"
                : "bg-red-950/80 text-red-200 border border-red-500/40"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-3 border-t border-white/10 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="btn-cobalt text-xs font-bold px-6 py-2.5 rounded-xl disabled:opacity-50"
          >
            {saving ? "Saving Preferences..." : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Step 13: Commit `feature/experiences-profile` and Merge

Confirm linting passes:

```bash
npm run lint
```

Commit changes and merge into `phase/phase4-movies`:

```bash
git add .
git commit -m "feat(phase4): 4-format experiences showcase, user interests API and profile settings"

# Merge into phase milestone
git checkout phase/phase4-movies
git merge feature/experiences-profile

# Delete temporary feature branch
git branch -d feature/experiences-profile
```

---

## Step 14: Verification Checkpoint

Start the development server:

```bash
npm run dev
```

Execute the verification tests:

### 1. Homepage (`/`)
- [ ] Loads without console errors or hydration warnings.
- [ ] Hero banner renders with background backdrop and active movie data from database.
- [ ] "Now Showing" section renders 5 movie cards matching movies that have `releaseDate <= today` and active showtimes.
- [ ] "Upcoming Releases" section renders 5 movie cards for movies with `releaseDate > today`.
- [ ] Movie cards are fully clickable links without inner button clutter.

### 2. Movies Catalog (`/movies`)
- [ ] Navigate to `/movies` — 2 tabs are visible (`Now Showing` and `Upcoming Releases`).
- [ ] Clicking between tabs toggles the corresponding list immediately.
- [ ] Real database status verification: Verify that if a movie has no active showtimes, it does not appear in "Now Showing".
- [ ] Search filter input filters movies by title or genre in real-time.

### 3. Experiences Page (`/experiences`)
- [ ] All 4 formats are displayed: **IMAX Laser**, **Dolby Cinema**, **4DX Motion**, and **VIP Lounge**.
- [ ] No duplicate header bar is rendered; page cleanly integrates below the global `Navbar`.

### 4. Profile Settings (`/profile`)
- [ ] Visiting `/profile` while signed out redirects to `/login?callbackUrl=/profile`.
- [ ] Sign in with a registered account and navigate to `/profile`.
- [ ] Member details card displays name, email, and role correctly.
- [ ] Click genre tags (e.g., "Action", "Sci-Fi"), click **"Save Preferences"**, and verify success message.
- [ ] Refresh the page; verify selected genres remain checked (persisted in PostgreSQL `UserInterest` table).

---

## Step 15: Merge `phase/phase4-movies` into `develop`

Once all verification steps pass, merge the milestone into `develop` and push to remote:

```bash
git checkout develop
git merge phase/phase4-movies

# Push both branches (preserve phase branch on GitHub -- NEVER delete)
git push origin develop
git push origin phase/phase4-movies
```

---

## Phase 4 Complete — Summary

| Deliverable | Status |
|:---|:---|
| Seed active showtimes for released movies | Done |
| Reusable data access layer (`movie.service.ts` & `user.service.ts`) | Done |
| Reusable `MovieCard` with image optimization & AI badge slot | Done |
| Interactive `HeroSpotlight` Client Component | Done |
| Server Component Homepage (`/`) querying live PostgreSQL DB via service | Done |
| Movies Catalog Page (`/movies`) with dynamic 2-tab layout | Done |
| Experiences Showcase (`/experiences`) with interactive filters & specs | Done |
| `GET/POST /api/user/interests` Route Handler delegating to `user.service.ts` | Done |
| Profile Settings Page (`/profile`) with persistent genre selection | Done |
| `feature/homepage-catalog` -> `phase/phase4-movies` | Merged & deleted |
| `feature/experiences-profile` -> `phase/phase4-movies` | Merged & deleted |
| `phase/phase4-movies` -> `develop` | Merged & preserved |

**Next up:** Phase 5 — AI Movie Recommendation Engine (Gemini LLM API)
