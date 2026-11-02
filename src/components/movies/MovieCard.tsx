// src/components/movies/MovieCard.tsx
// Minimal movie card: poster + AI match badge, title, and one meta line.
// The 1-sentence AI insight is revealed over the poster on hover/focus to keep the card uncluttered.
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
  matchScore,
  matchReason,
  isUpcoming = false,
  priority = false,
  showtimeId,
}: MovieCardProps) {
  const formattedDate = new Date(releaseDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const cardHref = !isUpcoming && showtimeId ? `/checkout/${showtimeId}` : `/movies#movie-${id}`;
  const hasMatch = typeof matchScore === "number";
  const metaLine = [isUpcoming ? `Opens ${formattedDate}` : formatDuration(duration), genres[0]]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={cardHref}
      prefetch={false}
      aria-label={[title, metaLine, hasMatch ? `${matchScore}% AI match. ${matchReason ?? ""}` : ""]
        .filter(Boolean)
        .join(". ")}
      className="group flex flex-col gap-3 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5938ff] focus-visible:ring-offset-4 focus-visible:ring-offset-[#03030d]"
    >
      {/* Poster */}
      <div className="relative w-full aspect-[2/3] overflow-hidden rounded-2xl bg-[#070820] border border-white/10 group-hover:border-[#5938ff]/70 transition-colors">
        <Image
          src={posterUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          priority={priority}
          className="object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* AI match score */}
        {hasMatch && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold text-white bg-[#2500f0]/90 backdrop-blur-sm">
            🔥 {matchScore}%
          </span>
        )}

        {/* AI insight — revealed on hover / keyboard focus */}
        {matchReason && (
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 p-3 pt-10 bg-gradient-to-t from-black/95 via-black/80 to-transparent text-xs leading-snug text-zinc-100 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-y-0 transition-all duration-300"
          >
            {matchReason}
          </div>
        )}
      </div>

      {/* Title + one meta line */}
      <div className="px-0.5">
        <h3 className="text-sm font-bold text-white group-hover:text-[#c7d2fe] transition-colors line-clamp-1">
          {title}
        </h3>
        <p className={`text-xs mt-0.5 line-clamp-1 ${isUpcoming ? "text-amber-300/90" : "text-zinc-400"}`}>
          {metaLine}
        </p>
      </div>
    </Link>
  );
}
