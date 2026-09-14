// src/components/layout/Navbar.tsx
// Auth-aware navigation bar — dynamically renders links and controls based on session & role

"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";
  const isAdmin = session?.user?.role === "ADMIN";

  const displayName =
    session?.user?.name ||
    (session?.user?.email ? session.user.email.split("@")[0] : "Account");

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#2500f0]/35 bg-[#040412]/85 backdrop-blur-2xl shadow-xl shadow-[#2500f0]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Brand Identity */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2500f0] to-[#12008a] p-[1px] shadow-lg shadow-[#2500f0]/60 group-hover:shadow-[#2500f0] transition-all duration-300">
            <div className="w-full h-full bg-[#070822] rounded-[11px] flex items-center justify-center border-t border-white/30">
              <span className="text-xl">🎬</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
              Cine<span className="text-[#5938ff] font-extrabold cobalt-text-glow">Go</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[#2500f0]/30 text-[#c7d2fe] border border-[#2500f0]/60 shadow-[0_0_12px_rgba(37,0,240,0.5)]">
                Cinema
              </span>
            </span>
            <span className="text-[10px] text-[#c7d2fe]/70 font-medium tracking-wider -mt-0.5 hidden sm:inline">
              RESERVED SEATING &amp; EXPERIENCES
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5 bg-[#090b2c]/85 border border-[#2500f0]/35 rounded-full px-4 py-1.5 backdrop-blur-md shadow-inner">
          <Link
            href="/movies"
            className="text-xs font-semibold text-[#e2e8f0] hover:text-white px-3.5 py-1.5 rounded-full hover:bg-white/[0.08] transition-colors"
          >
            Movies
          </Link>
          <Link
            href="/experiences"
            className="text-xs font-semibold text-[#e2e8f0] hover:text-white px-3.5 py-1.5 rounded-full hover:bg-white/[0.08] transition-colors"
          >
            Experiences
          </Link>
          {session && (
            <Link
              href="/tickets"
              className="text-xs font-semibold text-[#e2e8f0] hover:text-white px-3.5 py-1.5 rounded-full hover:bg-white/[0.08] transition-colors"
            >
              My Tickets
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              className="text-xs font-bold text-amber-400 hover:text-amber-300 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Admin
            </Link>
          )}
        </nav>

        {/* User Auth & Actions */}
        <div className="flex items-center gap-3">
          {isLoading ? (
            <div className="h-9 w-24 rounded-xl bg-white/[0.06] animate-pulse" />
          ) : session ? (
            <>
              <Link
                href="/profile"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-chip text-xs font-semibold text-white hover:border-[#5938ff] transition-all"
                title="View Profile"
              >
                <span className="w-6 h-6 rounded-lg bg-[#2500f0]/60 border border-white/20 flex items-center justify-center text-[10px] font-black text-white uppercase">
                  {displayName.charAt(0)}
                </span>
                <span className="max-w-[120px] truncate text-[#c7d2fe]">
                  {displayName}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-xs font-semibold text-zinc-300 hover:text-white px-3.5 py-2 rounded-xl border border-white/10 hover:border-white/25 hover:bg-white/[0.06] transition-all"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-xs font-semibold text-[#e2e8f0] hover:text-white px-3.5 py-2 rounded-xl hover:bg-white/[0.08] transition-all"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="btn-cobalt text-xs font-bold px-4 sm:px-5 py-2.5 rounded-xl flex items-center gap-2 tracking-wide"
              >
                <span>Get Started</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
