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
              prefetch={false}
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
              prefetch={false}
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
