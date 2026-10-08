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
  showtimeId,
}: MovieCardProps) {
  const formattedDate = new Date(releaseDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const cardHref = !isUpcoming && showtimeId ? `/checkout/${showtimeId}` : `/movies#movie-${id}`;

  return (
    <Link
      href={cardHref}
      prefetch={false}
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
