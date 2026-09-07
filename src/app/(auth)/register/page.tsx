import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account",
};

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[#03030d] relative overflow-hidden">
      {/* High-Luminance Monochromatic #2500f0 Atmospheric Glow */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[550px] h-[550px] bg-[#2500f0]/28 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-2xl">🎬</span>
            <span className="text-2xl font-black text-white tracking-tight">
              Cine<span className="text-[#5938ff] cobalt-text-glow">Go</span>
            </span>
          </Link>
          <h1 className="text-xl font-black text-white mt-4 tracking-tight">Create Your Pass</h1>
          <p className="text-[#c7d2fe] text-xs font-medium mt-1">Unlock instant digital tickets & personalized curation</p>
        </div>

        {/* Specular Frosted Cobalt Glass Card */}
        <div className="glass-panel-cobalt rounded-2xl p-6 sm:p-7 space-y-4 shadow-2xl">
          <div>
            <label className="block text-xs font-bold text-white mb-1.5 uppercase tracking-wider">
              Email Address
            </label>
            <input
              type="email"
              placeholder="cinephile@example.com"
              className="w-full bg-[#0a0d2e] border border-[#2500f0]/50 border-t-white/30 text-white placeholder-slate-400 font-medium rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#5938ff] focus:shadow-[0_0_18px_rgba(37,0,240,0.6)] transition-all"
              disabled
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-white mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full bg-[#0a0d2e] border border-[#2500f0]/50 border-t-white/30 text-white placeholder-slate-400 font-medium rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#5938ff] focus:shadow-[0_0_18px_rgba(37,0,240,0.6)] transition-all"
              disabled
            />
          </div>
          <button
            type="button"
            disabled
            className="btn-cobalt w-full disabled:opacity-50 disabled:cursor-not-allowed font-bold py-2.5 rounded-xl text-xs transition-all tracking-wide"
          >
            Create Account — Coming in Phase 3
          </button>
        </div>

        <p className="text-center text-xs text-[#c7d2fe] font-medium mt-5">
          Already a member?{" "}
          <Link href="/login" className="text-white hover:text-[#c7d2fe] font-bold underline underline-offset-4 decoration-[#2500f0] transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
