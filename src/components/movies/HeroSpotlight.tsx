// src/components/movies/HeroSpotlight.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatDuration } from "@/lib/utils";

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
  const current = movies[activeIndex] || movies[0];

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
            src={m.backdropUrl || m.posterUrl}
            alt={m.title}
            fill
            priority={idx === 0}
            className="object-cover object-center scale-105"
          />
          {/* Dynamic multi-stop lighting vignette */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#03030d] via-[#03030d]/65 via-35% to-transparent/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#03030d] via-transparent to-black/30" />
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
          <p className="text-xs sm:text-sm text-zinc-200 line-clamp-3 leading-relaxed max-w-xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
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
