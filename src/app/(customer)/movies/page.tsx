// src/app/(customer)/movies/page.tsx
// Movies Catalog -- 2-Tab Server & Client layout querying live database & AI recommendations
// Uses DB-persisted recommendations with in-flight deduplication for instant navigation.

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFormattedCatalogMovies } from "@/services/movie.service";
import { getMovieRecommendationsMap } from "@/services/recommendation.service";
import MoviesCatalogClient from "./MoviesCatalogClient";
import { RecommendationMap } from "@/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Movies Catalog",
  description: "Browse now showing blockbusters and upcoming cinema premieres.",
};

export default async function MoviesPage() {
  const [session, { nowShowing, upcoming }] = await Promise.all([
    getServerSession(authOptions),
    getFormattedCatalogMovies(),
  ]);

  const allMovieIds = [...nowShowing.map((m) => m.id), ...upcoming.map((m) => m.id)];
  const userId = session?.user?.id;

  // DB-cached lookup (~2-5ms) with on-demand compute fallback
  const recommendations: RecommendationMap = userId
    ? await getMovieRecommendationsMap(userId, allMovieIds)
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

        <MoviesCatalogClient
          nowShowing={nowShowing}
          upcoming={upcoming}
          recommendations={recommendations}
        />
      </div>
    </main>
  );
}
