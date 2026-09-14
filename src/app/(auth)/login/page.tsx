"use client";

// src/app/(auth)/login/page.tsx
// Login page — credentials sign-in via NextAuth

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password. Please try again.");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[#03030d] relative overflow-hidden">
      {/* Atmospheric Glow */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[550px] h-[550px] bg-[#2500f0]/28 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 animate-fadeIn">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-2xl">🎬</span>
            <span className="text-2xl font-black text-white tracking-tight">
              Cine<span className="text-[#5938ff] cobalt-text-glow">Go</span>
            </span>
          </Link>
          <h1 className="text-xl font-black text-white mt-4 tracking-tight">Welcome Back</h1>
          <p className="text-[#c7d2fe] text-xs font-medium mt-1">
            Access your cinema passes and reservations
          </p>
        </div>

        {/* Specular Frosted Cobalt Glass Card */}
        <div className="glass-panel-cobalt rounded-2xl p-6 sm:p-7 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="text-xs text-red-300 bg-red-950/50 border border-red-700/60 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-white mb-1.5 uppercase tracking-wider">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="cinephile@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-[#0a0d2e] border border-[#2500f0]/50 border-t-white/30 text-white placeholder-slate-400 font-medium rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#5938ff] focus:shadow-[0_0_18px_rgba(37,0,240,0.6)] transition-all disabled:opacity-60"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-white mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-[#0a0d2e] border border-[#2500f0]/50 border-t-white/30 text-white placeholder-slate-400 font-medium rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#5938ff] focus:shadow-[0_0_18px_rgba(37,0,240,0.6)] transition-all disabled:opacity-60"
              />
            </div>

            {/* Submit */}
            <button
              id="btn-sign-in"
              type="submit"
              disabled={loading}
              className="btn-cobalt w-full font-bold py-2.5 rounded-xl text-xs tracking-wide disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="text-center text-xs text-[#c7d2fe] font-medium mt-5">
            New to CineGo?{" "}
            <Link
              href="/register"
              className="text-white hover:text-[#c7d2fe] font-bold underline underline-offset-4 decoration-[#2500f0] transition-colors"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
