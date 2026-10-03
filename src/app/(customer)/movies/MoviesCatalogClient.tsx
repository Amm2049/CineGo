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
