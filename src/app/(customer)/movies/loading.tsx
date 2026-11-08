// src/app/(customer)/movies/loading.tsx
// Instant skeleton for the Film Catalog while movies + recommendations load

import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export default function MoviesLoading() {
  return (
    <LoadingRegion
      label="Loading movies"
      className="flex-1 min-h-screen bg-[#03030d] text-white py-12"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Static header — real text, so the page feels like it has arrived */}
        <header className="mb-10 text-center space-y-3">
          <span className="inline-block text-[11px] uppercase font-bold tracking-widest text-[#a5b4fc] bg-[#2500f0]/20 border border-[#2500f0]/40 px-3.5 py-1 rounded-full">
            Now Showing & Coming Soon
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
            Film Catalog
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto">
            Pick a movie to see its showtimes and choose your seats.
          </p>
        </header>

        <div className="space-y-8">
          {/* Tabs + search bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-[#2500f0]/20">
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32 rounded-xl" />
              <Skeleton className="h-10 w-28 rounded-xl" />
            </div>
            <Skeleton className="h-10 w-full sm:w-64 rounded-xl" />
          </div>

          {/* Poster grid — same breakpoints as MoviesCatalogClient */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="w-full aspect-[2/3] rounded-2xl" />
                <div className="space-y-1.5 px-0.5">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
