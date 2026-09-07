"use client";

import { useState } from "react";
import Link from "next/link";

// ── Curated Premier Spotlight Movies for Hero Section ──
const HERO_SPOTLIGHT_MOVIES = [
  {
    id: "Doomsday",
    title: "Avengers: Doomsday",
    hook: "Long live the fighters. Experience Paul Atreides' mythic journey in full expanded 1.43:1 ratio.",
    backdrop: "https://cdn.marvel.com/content/2x/avengersdoomsday_lob_mas_mob_03.webp",
    poster: "https://cdn.marvel.com/content/1x_masonry/avengersdoomsday_teaser-a_1830_fin16_digital_mech1.webp",
    runtime: "2h 46m",
    rating: "PG-13",
    userScore: "8.8",
    criticScore: "93%",
    format: "IMAX 70MM DUAL LASER",
    genres: ["Sci-Fi", "Action", "Adventure"],
    director: "Denis Villeneuve",
    trailerUrl: "https://www.youtube.com/embed/Way9Dexny3w",
    nextShowtime: "16:45 Today",
  },
  {
    id: "oppenheimer",
    title: "Oppenheimer",
    hook: "The story of American scientist J. Robert Oppenheimer and his role in the Manhattan Project.",
    backdrop: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=2070&auto=format&fit=crop",
    poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop",
    runtime: "3h 00m",
    rating: "R",
    userScore: "8.9",
    criticScore: "93%",
    format: "IMAX 70MM EXCLUSIVE",
    genres: ["Biography", "Drama", "History"],
    director: "Christopher Nolan",
    trailerUrl: "https://www.youtube.com/embed/uYPbbksJxIg",
    nextShowtime: "18:00 Today",
  },
  {
    id: "interstellar",
    title: "Interstellar: 10th Anniversary",
    hook: "Mankind was born on Earth. It was never meant to die here. Restored in native 4K laser projection.",
    backdrop: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=2070&auto=format&fit=crop",
    poster: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=600&auto=format&fit=crop",
    runtime: "2h 49m",
    rating: "PG-13",
    userScore: "8.7",
    criticScore: "86%",
    format: "IMAX LASER 4K",
    genres: ["Sci-Fi", "Adventure", "Drama"],
    director: "Christopher Nolan",
    trailerUrl: "https://www.youtube.com/embed/zSWdZVtXT7E",
    nextShowtime: "19:00 Today",
  },
  {
    id: "blade-runner",
    title: "Blade Runner 2049",
    hook: "A young blade runner's discovery of a long-buried secret leads him to track down former runner Rick Deckard.",
    backdrop: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=2070&auto=format&fit=crop",
    poster: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop",
    runtime: "2h 44m",
    rating: "R",
    userScore: "8.0",
    criticScore: "88%",
    format: "DOLBY ATMOS & VISION",
    genres: ["Sci-Fi", "Mystery", "Action"],
    director: "Denis Villeneuve",
    trailerUrl: "https://www.youtube.com/embed/gCcx85zbxz4",
    nextShowtime: "20:15 Today",
  },
];

const NOW_SHOWING_MOVIES = [
  {
    id: "m-1",
    title: "Oppenheimer",
    director: "Christopher Nolan",
    runtime: "3h 00m",
    rating: "R",
    matchScore: 98,
    genres: ["Biography", "Drama", "History"],
    image: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop",
    formats: ["IMAX 70mm", "Dolby Cinema"],
    startingPrice: 280,
    showtimeSummary: "4 Showtimes Today",
  },
  {
    id: "m-2",
    title: "Interstellar: 10th Anniversary",
    director: "Christopher Nolan",
    runtime: "2h 49m",
    rating: "PG-13",
    matchScore: 96,
    genres: ["Sci-Fi", "Adventure"],
    image: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=800&auto=format&fit=crop",
    formats: ["IMAX Laser", "Digital 4K"],
    startingPrice: 260,
    showtimeSummary: "5 Showtimes Today",
  },
  {
    id: "m-3",
    title: "Blade Runner 2049",
    director: "Denis Villeneuve",
    runtime: "2h 44m",
    rating: "R",
    matchScore: 94,
    genres: ["Sci-Fi", "Mystery"],
    image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop",
    formats: ["Dolby Atmos", "Standard"],
    startingPrice: 240,
    showtimeSummary: "3 Showtimes Today",
  },
  {
    id: "m-4",
    title: "Spider-Man: Across The Spider-Verse",
    director: "Joaquim Dos Santos",
    runtime: "2h 20m",
    rating: "PG",
    matchScore: 92,
    genres: ["Animation", "Action", "Adventure"],
    image: "https://images.unsplash.com/photo-1635805737707-575885ab0820?q=80&w=800&auto=format&fit=crop",
    formats: ["Dolby 3D", "IMAX Laser"],
    startingPrice: 240,
    showtimeSummary: "6 Showtimes Today",
  },
  {
    id: "m-5",
    title: "Dune: Part Two",
    director: "Denis Villeneuve",
    runtime: "2h 46m",
    rating: "PG-13",
    matchScore: 99,
    genres: ["Sci-Fi", "Action", "Adventure"],
    image: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=800&auto=format&fit=crop",
    formats: ["IMAX 70mm", "Dolby Vision"],
    startingPrice: 280,
    showtimeSummary: "5 Showtimes Today",
  },
  {
    id: "m-6",
    title: "The Batman",
    director: "Matt Reeves",
    runtime: "2h 56m",
    rating: "PG-13",
    matchScore: 91,
    genres: ["Action", "Crime", "Drama"],
    image: "https://images.unsplash.com/photo-1509281373149-e957c6296406?q=80&w=800&auto=format&fit=crop",
    formats: ["Dolby Atmos", "VIP Lounge"],
    startingPrice: 260,
    showtimeSummary: "4 Showtimes Today",
  },
  {
    id: "m-7",
    title: "Everything Everywhere All At Once",
    director: "Daniel Kwan & Daniel Scheinert",
    runtime: "2h 19m",
    rating: "R",
    matchScore: 95,
    genres: ["Sci-Fi", "Comedy", "Adventure"],
    image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=800&auto=format&fit=crop",
    formats: ["Digital 4K", "Standard"],
    startingPrice: 220,
    showtimeSummary: "3 Showtimes Today",
  },
  {
    id: "m-8",
    title: "Top Gun: Maverick",
    director: "Joseph Kosinski",
    runtime: "2h 10m",
    rating: "PG-13",
    matchScore: 93,
    genres: ["Action", "Drama"],
    image: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=800&auto=format&fit=crop",
    formats: ["IMAX Laser", "Dolby Atmos"],
    startingPrice: 260,
    showtimeSummary: "4 Showtimes Today",
  },
];

const UPCOMING_MOVIES = [
  {
    id: "up-1",
    title: "Avatar: Fire and Ash",
    releaseDate: "Dec 19, 2025",
    director: "James Cameron",
    genres: ["Sci-Fi", "Adventure", "Action"],
    matchScore: 97,
    image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop",
    format: "IMAX 3D HFR",
    trailerUrl: "https://www.youtube.com/embed/Way9Dexny3w",
  },
  {
    id: "up-2",
    title: "Gladiator II",
    releaseDate: "Nov 22, 2025",
    director: "Ridley Scott",
    genres: ["Action", "Drama", "History"],
    matchScore: 94,
    image: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop",
    format: "Dolby Cinema",
    trailerUrl: "https://www.youtube.com/embed/uYPbbksJxIg",
  },
  {
    id: "up-3",
    title: "Tron: Ares",
    releaseDate: "Oct 10, 2025",
    director: "Joachim Rønning",
    genres: ["Sci-Fi", "Action"],
    matchScore: 92,
    image: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=800&auto=format&fit=crop",
    format: "IMAX Laser 4K",
    trailerUrl: "https://www.youtube.com/embed/zSWdZVtXT7E",
  },
  {
    id: "up-4",
    title: "Wicked: Part Two",
    releaseDate: "Nov 26, 2025",
    director: "Jon M. Chu",
    genres: ["Fantasy", "Musical"],
    matchScore: 89,
    image: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=800&auto=format&fit=crop",
    format: "Dolby Atmos",
    trailerUrl: "https://www.youtube.com/embed/gCcx85zbxz4",
  },
  {
    id: "up-5",
    title: "Mickey 17",
    releaseDate: "Jan 31, 2026",
    director: "Bong Joon-ho",
    genres: ["Sci-Fi", "Comedy"],
    matchScore: 96,
    image: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=800&auto=format&fit=crop",
    format: "IMAX 70mm",
    trailerUrl: "https://www.youtube.com/embed/Way9Dexny3w",
  },
  {
    id: "up-6",
    title: "Mission: Impossible 8",
    releaseDate: "May 23, 2026",
    director: "Christopher McQuarrie",
    genres: ["Action", "Thriller"],
    matchScore: 95,
    image: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=800&auto=format&fit=crop",
    format: "IMAX Laser",
    trailerUrl: "https://www.youtube.com/embed/uYPbbksJxIg",
  },
];

export default function HomePage() {
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [trailerModalOpen, setTrailerModalOpen] = useState(false);

  const currentMovie = HERO_SPOTLIGHT_MOVIES[activeHeroIndex];

  const handleSelectHeroMovie = (index: number) => {
    setActiveHeroIndex(index);
  };

  return (
    <main className="flex-1 flex flex-col min-h-screen pb-20 sm:pb-0 relative">
      {/* ── 1. ELECTRIC LUXE SPECULAR GLASS NAVIGATION BAR ── */}
      <header className="sticky top-0 z-50 w-full border-b border-[#2500f0]/35 bg-[#040412]/85 backdrop-blur-2xl shadow-xl shadow-[#2500f0]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2500f0] to-[#12008a] p-[1px] shadow-lg shadow-[#2500f0]/60 group-hover:shadow-[#2500f0] transition-all duration-300">
              <div className="w-full h-full bg-[#070822] rounded-[11px] flex items-center justify-center border-t border-white/30">
                <svg
                  className="w-5 h-5 text-white group-hover:scale-110 transition-transform duration-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                  />
                </svg>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                Cine<span className="text-[#2500f0] font-extrabold cobalt-text-glow">Go</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[#2500f0]/30 text-[#c7d2fe] border border-[#2500f0]/60 shadow-[0_0_12px_rgba(37,0,240,0.5)]">
                  Cinema
                </span>
              </span>
              <span className="text-[10px] text-[#c7d2fe]/70 font-medium tracking-wider -mt-0.5 hidden sm:inline">
                RESERVED SEATING & EXPERIENCES
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-[#090b2c]/85 border border-[#2500f0]/35 rounded-full px-4 py-1.5 backdrop-blur-md shadow-inner">
            <Link
              href="#now-showing"
              className="text-xs font-semibold text-white px-3.5 py-1.5 rounded-full bg-[#2500f0] border-t border-white/40 shadow-[0_0_15px_rgba(37,0,240,0.7)] transition-all"
            >
              Now Screening
            </Link>
            <Link
              href="/movies"
              className="text-xs font-semibold text-[#e2e8f0] hover:text-white px-3.5 py-1.5 rounded-full hover:bg-white/[0.08] transition-colors"
            >
              All Films
            </Link>
            <Link
              href="/experiences"
              className="text-xs font-semibold text-[#e2e8f0] hover:text-white px-3.5 py-1.5 rounded-full hover:bg-white/[0.08] transition-colors"
            >
              Experiences
            </Link>
          </nav>

          {/* User Auth & Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold text-[#e2e8f0] hover:text-white px-3.5 py-2 rounded-lg hover:bg-white/[0.08] transition-all hidden sm:inline-block"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="btn-cobalt text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 tracking-wide"
            >
              <span>Get Pass</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* ── 2. REDESIGNED CINEMA-GRADE SPOTLIGHT HERO SECTION ── */}
      <section className="relative w-full overflow-hidden isolate border-b border-[#2500f0]/30 min-h-[540px] lg:min-h-[660px] flex flex-col justify-center bg-[#03030d]">
        {/* Dynamic Widescreen Backdrop with High Visual Clarity */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={currentMovie.backdrop}
            src={currentMovie.backdrop}
            alt={currentMovie.title}
            className="w-full h-full object-cover object-center filter brightness-[0.82] contrast-[1.10] transition-opacity duration-700 animate-fadeIn"
          />
          {/* Subtle Left gradient for text legibility without swallowing the artwork */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#03030d]/90 via-[#03030d]/50 to-transparent w-full lg:w-3/5" />
          {/* Soft Bottom vignette to blend into Now Screening section */}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#03030d] via-[#03030d]/60 to-transparent" />
          {/* Soft Top subtle vignette for navbar transition */}
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#03030d]/60 to-transparent" />
          {/* Ambient subtle electric cobalt atmosphere */}
          <div className="absolute -top-20 right-1/4 w-[500px] h-[500px] bg-[#2500f0]/20 rounded-full blur-[140px]" />
        </div>

        {/* Hero Content Grid (Left: Active Movie Info / Right: Spotlight Carousel Switcher) */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 w-full flex flex-col lg:flex-row lg:items-center justify-between gap-10">
          {/* Left Column: Active Movie Highlight (Anchored layout, no jumping) */}
          <div className="max-w-2xl space-y-4 flex flex-col justify-start">
            {/* Format Pill & Metadata Row */}
            <div className="flex flex-wrap items-center gap-2.5 h-7">
              <span className="glass-chip text-white border-t border-white/40 bg-[#2500f0]/35 text-[11px] font-bold tracking-wider uppercase px-3 py-1 rounded-full flex items-center gap-2 shadow-[0_0_18px_rgba(37,0,240,0.5)]">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                {currentMovie.format}
              </span>
              <span className="glass-chip text-white font-bold text-xs px-2.5 py-0.5 rounded-md font-mono border border-white/20">
                {currentMovie.rating}
              </span>
              <span className="text-xs text-[#e0e7ff] flex items-center gap-1.5 font-semibold">
                <svg className="w-3.5 h-3.5 text-[#7053ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {currentMovie.runtime}
              </span>
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                ★ {currentMovie.userScore}
                <span className="text-[11px] text-[#c7d2fe] font-medium">({currentMovie.criticScore} Critics)</span>
              </span>
            </div>

            {/* Movie Title & Hook with Fixed Allocation to Prevent Text Shifting */}
            <div className="space-y-2">
              <div className="min-h-[4rem] sm:min-h-[4.5rem] lg:min-h-[5.25rem] flex items-center">
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight uppercase drop-shadow-[0_4px_30px_rgba(37,0,240,0.7)] font-sans line-clamp-2">
                  {currentMovie.title}
                </h1>
              </div>
              <div className="min-h-[3rem] sm:min-h-[3rem] flex items-start">
                <p className="text-sm sm:text-base text-[#c7d2fe] font-medium leading-relaxed max-w-xl line-clamp-2">
                  {currentMovie.hook}
                </p>
              </div>
            </div>

            {/* Quick Metadata & Genre Tags */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5 min-h-[34px]">
              <span className="text-xs font-bold text-white bg-[#0a0d33] border border-[#2500f0]/50 px-3 py-1 rounded-lg">
                🎬 Dir. {currentMovie.director}
              </span>
              {currentMovie.genres.map((g) => (
                <span key={g} className="text-xs font-semibold text-[#cbd5e1] bg-white/[0.05] border border-white/10 px-2.5 py-1 rounded-lg">
                  {g}
                </span>
              ))}
              <span className="text-xs font-bold text-[#a5b4fc] bg-[#2500f0]/20 border border-[#2500f0]/40 px-2.5 py-1 rounded-lg">
                ⚡ Next: {currentMovie.nextShowtime}
              </span>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <Link
                href="/movies"
                className="btn-cobalt text-sm font-bold px-7 py-3.5 rounded-xl flex items-center gap-2.5"
              >
                <span>🎟️ Get Tickets</span>
                <span className="text-xs text-white/80 font-normal">from ฿280</span>
              </Link>

              <button
                type="button"
                onClick={() => setTrailerModalOpen(true)}
                className="glass-card text-white hover:text-white text-sm font-bold px-6 py-3.5 rounded-xl flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-[#5938ff]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>Watch Trailer</span>
              </button>
            </div>
          </div>

          {/* Right Column: Interactive Spotlight Movie Switcher */}
          <div className="w-full lg:max-w-md space-y-3">
            <div className="flex items-center justify-between text-xs font-bold tracking-wider uppercase text-[#c7d2fe]">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2500f0]" />
                Featured Premieres ({activeHeroIndex + 1} of {HERO_SPOTLIGHT_MOVIES.length})
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous Featured Movie"
                  onClick={() =>
                    handleSelectHeroMovie(
                      (activeHeroIndex - 1 + HERO_SPOTLIGHT_MOVIES.length) % HERO_SPOTLIGHT_MOVIES.length
                    )
                  }
                  className="w-7 h-7 rounded-lg glass-chip flex items-center justify-center text-white hover:bg-[#2500f0]"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next Featured Movie"
                  onClick={() =>
                    handleSelectHeroMovie((activeHeroIndex + 1) % HERO_SPOTLIGHT_MOVIES.length)
                  }
                  className="w-7 h-7 rounded-lg glass-chip flex items-center justify-center text-white hover:bg-[#2500f0]"
                >
                  ›
                </button>
              </div>
            </div>

            {/* Quick Switcher Cards Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-2 gap-2.5">
              {HERO_SPOTLIGHT_MOVIES.map((movie, index) => {
                const isActive = index === activeHeroIndex;
                return (
                  <button
                    key={movie.id}
                    type="button"
                    onClick={() => handleSelectHeroMovie(index)}
                    className={`text-left rounded-xl p-2.5 transition-all flex items-center gap-3 relative overflow-hidden ${isActive
                      ? "glass-panel-cobalt border-[#2500f0] border-t-white/40 shadow-lg shadow-[#2500f0]/40"
                      : "glass-card opacity-75 hover:opacity-100"
                      }`}
                  >
                    <div
                      className="w-11 h-14 rounded-lg bg-cover bg-center shrink-0 border border-white/10"
                      style={{ backgroundImage: `url('${movie.poster}')` }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-[#a5b4fc] truncate">
                        {movie.format.split(" ")[0]}
                      </div>
                      <div className="text-xs font-black text-white truncate mt-0.5">
                        {movie.title}
                      </div>
                      <div className="text-[10px] text-[#cbd5e1] flex items-center gap-1.5 mt-0.5">
                        <span>{movie.runtime}</span>
                        <span>•</span>
                        <span className="text-amber-400 font-bold">★ {movie.userScore}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. NOW SCREENING REEL (HIGH-CONTRAST POSTER CARDS) ── */}
      <section id="now-showing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full space-y-8">
        {/* Section Header (Clean Cinema Schedule Header, No Filter Clutter) */}
        <div className="flex items-end justify-between gap-4 border-b border-[#2500f0]/25 pb-5">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#c7d2fe] font-bold mb-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2500f0] animate-ping" />
              Now Playing in Theatres
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Now Screening
            </h2>
          </div>

          <Link
            href="/movies"
            className="group flex items-center gap-2 text-xs font-bold text-[#c7d2fe] hover:text-white transition-colors bg-[#080a29] border border-[#2500f0]/40 px-4 py-2 rounded-xl"
          >
            <span>View All Movies (24)</span>
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
        </div>

        {/* 5-Card Responsive Grid (Exact Dimensions & Unified Optical Alignment) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
          {NOW_SHOWING_MOVIES.slice(0, 5).map((movie) => (
            <Link
              key={movie.id}
              href="/movies"
              className="glass-card rounded-2xl overflow-hidden flex flex-col group transition-all duration-300 hover:border-[#2500f0]/80 hover:shadow-xl hover:shadow-[#2500f0]/25 hover:-translate-y-1 block"
            >
              {/* Poster Image Frame with Standard 2:3 Ratio */}
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#070924]">
                <div
                  className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
                  style={{ backgroundImage: `url('${movie.image}')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#03030d] via-transparent to-black/30" />

                {/* Top Badge Bar: Horizontally & Vertically Aligned */}
                <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2 z-10">
                  <span className="bg-[#2500f0] text-white text-[10px] font-bold border-t border-white/40 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-[0_0_12px_rgba(37,0,240,0.8)] h-5.5 leading-none shrink-0">
                    🔥 {movie.matchScore}%
                  </span>
                  <span className="bg-black/80 backdrop-blur-md text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded-md border border-white/20 h-5.5 flex items-center leading-none shrink-0">
                    {movie.rating}
                  </span>
                </div>

                {/* Format tag at bottom */}
                <div className="absolute bottom-3 inset-x-3 flex items-center">
                  <span className="text-[9px] uppercase tracking-wider bg-[#070924]/90 backdrop-blur-md text-[#e0e7ff] px-2 py-0.5 rounded-md font-bold border border-white/20 h-5 flex items-center leading-none">
                    {movie.formats[0]}
                  </span>
                </div>
              </div>

              {/* Movie Details (Balanced Typography with Stable Heights) */}
              <div className="p-3.5 flex flex-col justify-between flex-1 space-y-2">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] text-[#a5b4fc] font-bold uppercase tracking-wider truncate">
                      {movie.director}
                    </span>
                    <span className="text-xs font-black text-white shrink-0">
                      ฿{movie.startingPrice}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-white group-hover:text-[#a5b4fc] transition-colors line-clamp-1 mt-1">
                    {movie.title}
                  </h3>
                </div>
                <div className="text-[11px] text-[#c7d2fe] font-medium flex items-center gap-1.5 pt-1 border-t border-white/10">
                  <span>{movie.runtime}</span>
                  <span>•</span>
                  <span className="line-clamp-1">{movie.genres.slice(0, 2).join(", ")}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 5. UPCOMING RELEASES (HORIZONTAL SCROLL REEL - IDENTICAL 5-CARD SIZING) ── */}
      <section className="w-full bg-[#050720]/80 border-t border-[#2500f0]/25 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-[#c7d2fe] font-bold mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2500f0]" />
                Coming Soon to Theatres
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Anticipated Premieres
              </h2>
            </div>

            <Link
              href="/movies"
              className="group flex items-center gap-2 text-xs font-bold text-[#c7d2fe] hover:text-white transition-colors bg-[#080a29] border border-[#2500f0]/40 px-4 py-2 rounded-xl shrink-0"
            >
              <span>View All Upcoming</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          </div>

          {/* Horizontal Reel (Identical Proportions to Now Screening) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
            {UPCOMING_MOVIES.slice(0, 5).map((movie) => (
              <Link
                key={movie.id}
                href="/movies"
                className="glass-card rounded-2xl overflow-hidden flex flex-col group transition-all duration-300 hover:border-[#2500f0]/80 hover:shadow-xl hover:shadow-[#2500f0]/25 hover:-translate-y-1 block"
              >
                {/* Poster Frame with Exact 2:3 Ratio */}
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#070924]">
                  <div
                    className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
                    style={{ backgroundImage: `url('${movie.image}')` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#03030d] via-transparent to-black/30" />

                  {/* Top Badge Bar: Exactly Centered & Horizontally Aligned */}
                  <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2 z-10">
                    <span className="bg-[#2500f0] text-white text-[10px] font-bold border-t border-white/40 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-[0_0_12px_rgba(37,0,240,0.8)] h-5.5 leading-none shrink-0">
                      🔥 {movie.matchScore}%
                    </span>
                    <span className="bg-black/80 backdrop-blur-md text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded-md border border-white/20 h-5.5 flex items-center leading-none shrink-0">
                      {movie.releaseDate.split(",")[0]}
                    </span>
                  </div>

                  {/* Format tag */}
                  <div className="absolute bottom-3 inset-x-3 flex items-center">
                    <span className="text-[9px] uppercase tracking-wider bg-[#070924]/90 backdrop-blur-md text-[#e0e7ff] px-2 py-0.5 rounded-md font-bold border border-white/20 h-5 flex items-center leading-none">
                      {movie.format}
                    </span>
                  </div>
                </div>

                {/* Details (Identical Heights and Layout) */}
                <div className="p-3.5 flex flex-col justify-between flex-1 space-y-2">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] text-[#a5b4fc] font-bold uppercase tracking-wider truncate">
                        {movie.director}
                      </span>
                      <span className="text-[10px] font-bold text-[#c7d2fe]/70 uppercase tracking-wider shrink-0">
                        Coming Soon
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-white group-hover:text-[#a5b4fc] transition-colors line-clamp-1 mt-1">
                      {movie.title}
                    </h3>
                  </div>
                  <div className="text-[11px] text-[#c7d2fe] font-medium truncate pt-1 border-t border-white/10">
                    {movie.genres.slice(0, 2).join(", ")}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. SLEEK RESPONSIVE FOOTER ── */}
      <footer className="border-t border-[#2500f0]/25 bg-[#02020a] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#2500f0] border-t border-white/40 flex items-center justify-center text-white font-black text-sm shadow-[0_0_15px_rgba(37,0,240,0.7)]">
                🎬
              </div>
              <div>
                <div className="text-sm font-black text-white">
                  Cine<span className="text-[#2500f0]">Go</span>
                </div>
                <div className="text-xs text-[#c7d2fe]/70 font-medium">
                  Precision Cinema Booking & AI Discovery
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-[#e2e8f0]">
              <Link href="/movies" className="hover:text-white transition-colors font-semibold">
                Showtimes & Tickets
              </Link>
              <Link href="/admin" className="hover:text-[#c7d2fe] transition-colors font-semibold">
                Staff Scanner Portal
              </Link>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 font-normal">© 2026 CineGo. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── 7. INTERACTIVE TRAILER MODAL ── */}
      {trailerModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
          <div className="relative w-full max-w-4xl glass-panel-cobalt rounded-3xl overflow-hidden shadow-2xl border border-[#2500f0]/60 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#a5b4fc] uppercase tracking-wider">
                  Official Trailer
                </span>
                <h3 className="text-xl font-black text-white">{currentMovie.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setTrailerModalOpen(false)}
                className="w-8 h-8 rounded-full glass-chip flex items-center justify-center text-white text-lg font-bold hover:bg-[#2500f0]"
              >
                ✕
              </button>
            </div>

            {/* Video Player Frame */}
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/10">
              <iframe
                className="w-full h-full"
                src={`${currentMovie.trailerUrl}?autoplay=1`}
                title={`${currentMovie.title} Trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-[#c7d2fe] font-medium hidden sm:inline">
                {currentMovie.format} · Next screening {currentMovie.nextShowtime}
              </span>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setTrailerModalOpen(false)}
                  className="glass-chip text-xs font-bold px-4 py-2 rounded-xl text-white"
                >
                  Close
                </button>
                <Link
                  href="/movies"
                  className="btn-cobalt text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2"
                >
                  <span>🎟️ Book Tickets for this Movie</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. MOBILE NATIVE BOTTOM NAVIGATION BAR (HIGH CONTRAST) ── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#040412]/95 backdrop-blur-2xl border-t border-white/15 px-4 py-2 flex items-center justify-around shadow-[0_-4px_25px_rgba(0,0,0,0.8)]">
        <Link href="/" className="flex flex-col items-center gap-0.5 text-white">
          <svg className="w-5 h-5 drop-shadow-[0_0_10px_rgba(37,0,240,1)] text-[#5938ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[10px] font-bold">Home</span>
        </Link>
        <Link href="/movies" className="flex flex-col items-center gap-0.5 text-[#e2e8f0] hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
          <span className="text-[10px] font-semibold">Movies</span>
        </Link>
        <Link href="/login" className="flex flex-col items-center gap-0.5 text-[#e2e8f0] hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
          <span className="text-[10px] font-semibold">My Tickets</span>
        </Link>
        <Link href="/login" className="flex flex-col items-center gap-0.5 text-[#e2e8f0] hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-[10px] font-semibold">Account</span>
        </Link>
      </div>
    </main>
  );
}
