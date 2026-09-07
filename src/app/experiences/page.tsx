import Link from "next/link";

const AUDITORIUM_SPECS = [
  {
    id: "imax",
    name: "IMAX® with Laser",
    badge: "Maximum Immersion",
    spec: "Dual 4K Laser Projection · 1.43:1 Expanded Aspect Ratio",
    desc: "Experience up to 40% more picture with unparalleled laser sharpness and a custom 12-channel soundstage tuned for visceral physical resonance.",
    features: [
      "Next-Gen 4K Laser Optical Engine",
      "Sub-bass Transducers in Every Seat",
      "Floor-to-Ceiling Curved Canvas",
      "Laser-Aligned Digital Audio",
    ],
    highlight: "Best for Sci-Fi blockbusters and Nolan epics",
  },
  {
    id: "dolby",
    name: "Dolby Cinema & Atmos®",
    badge: "Acoustic Perfection",
    spec: "64-Channel Spatial Sound · Dolby Vision HDR",
    desc: "Individual sound elements flow dynamically above and around you with true obsidian blacks and a 1,000,000:1 dynamic contrast ratio.",
    features: [
      "Object-Based Spatial Sound Elements",
      "Dual 4K Christie Laser Projectors",
      "Zero-Spill Matte Black Interior",
      "Dolby Vision High Dynamic Range",
    ],
    highlight: "Best for acoustic mastery and dramatic contrast",
  },
  {
    id: "vip",
    name: "The Director's Lounge",
    badge: "VIP Hospitality",
    spec: "Motorized Zero-Gravity Recliners · At-Seat Service",
    desc: "Curated for uncompromising luxury. Enjoy in-theatre artisanal dining and handcrafted cocktails delivered silently to your personal private pod.",
    features: [
      "Heated Italian Leather Recliners",
      "Acoustic Privacy Isolation Pods",
      "Call-Button At-Seat Waiter Service",
      "Artisanal Dining & Champagne Menu",
    ],
    highlight: "Best for date nights and luxury relaxation",
  },
];

export default function ExperiencesPage() {
  return (
    <main className="flex-1 flex flex-col min-h-screen bg-[#03030d] text-white">
      {/* Header Bar */}
      <header className="sticky top-0 z-50 w-full border-b border-[#2500f0]/35 bg-[#040412]/85 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2500f0] to-[#12008a] p-[1px] shadow-lg shadow-[#2500f0]/60">
              <div className="w-full h-full bg-[#070822] rounded-[11px] flex items-center justify-center border-t border-white/30">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                Cine<span className="text-[#2500f0] font-extrabold cobalt-text-glow">Go</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[#2500f0]/30 text-[#c7d2fe] border border-[#2500f0]/60">
                  Experiences
                </span>
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs font-semibold text-[#e2e8f0] hover:text-white px-3.5 py-1.5 rounded-full hover:bg-white/[0.08] transition-colors"
            >
              ← Back to Home
            </Link>
            <Link
              href="/movies"
              className="btn-cobalt text-xs font-bold px-4 py-2 rounded-xl"
            >
              Browse Movies
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="relative py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center space-y-4">
        <div className="inline-flex items-center gap-2 glass-chip text-white text-xs font-bold px-4 py-1.5 rounded-full border-t border-white/40">
          <span className="w-2 h-2 rounded-full bg-[#2500f0] animate-ping" />
          The CineGo Precision Standards
        </div>
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight uppercase drop-shadow-[0_4px_30px_rgba(37,0,240,0.6)]">
          Engineered For Pure Immersion
        </h1>
        <p className="text-sm sm:text-base text-[#c7d2fe] max-w-2xl mx-auto leading-relaxed">
          Not all screens are created equal. Discover how our custom calibrated laser projection, 
          spatial acoustics, and VIP hospitality redefine how cinema is experienced.
        </p>
      </section>

      {/* Experience Showcase Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        {AUDITORIUM_SPECS.map((spec) => (
          <div
            key={spec.id}
            className="glass-panel-cobalt rounded-3xl p-7 flex flex-col justify-between space-y-6 relative overflow-hidden group hover:border-[#2500f0] transition-all duration-300"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-black tracking-widest text-[#a5b4fc] bg-[#2500f0]/30 border border-[#2500f0]/50 px-3 py-1 rounded-full">
                  {spec.badge}
                </span>
              </div>

              <h2 className="text-2xl font-black text-white tracking-tight">{spec.name}</h2>
              <div className="text-xs font-mono font-bold text-[#c7d2fe] bg-black/40 p-3 rounded-xl border border-white/10">
                {spec.spec}
              </div>

              <p className="text-xs text-[#e2e8f0] leading-relaxed">
                {spec.desc}
              </p>

              <div className="space-y-2 pt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                  Key Specifications
                </div>
                <ul className="space-y-1.5">
                  {spec.features.map((feat) => (
                    <li key={feat} className="text-xs text-[#c7d2fe] flex items-center gap-2">
                      <span className="text-[#5938ff] font-bold">✓</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-3">
              <div className="text-[11px] font-semibold text-white/80 italic">
                🎯 {spec.highlight}
              </div>
              <Link
                href="/movies"
                className="btn-cobalt w-full text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2"
              >
                <span>Find {spec.name} Showtimes</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
