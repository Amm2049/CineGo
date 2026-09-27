// src/app/experiences/page.tsx
// CineGo Experiences FYI Showcase -- Flagship Formats & Global Cinema Technology Standards

import ExperiencesClient from "./ExperiencesClient";

export const metadata = {
  title: "Auditorium Experiences",
  description: "Explore CineGo cutting-edge cinema screen formats and audio technologies.",
};

export default function ExperiencesPage() {
  return (
    <main className="flex-1 flex flex-col min-h-screen bg-[#03030d] text-white py-12">
      {/* Hero Banner */}
      <section className="relative py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center space-y-4">
        <div className="inline-flex items-center gap-2 glass-chip text-white text-xs font-bold px-4 py-1.5 rounded-full border border-[#2500f0]/50">
          <span className="w-2 h-2 rounded-full bg-[#2500f0] animate-ping" />
          The CineGo Precision Standards
        </div>
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight uppercase drop-shadow-[0_4px_30px_rgba(37,0,240,0.6)]">
          Engineered For Pure Immersion
        </h1>
        <p className="text-xs sm:text-sm text-[#c7d2fe] max-w-2xl mx-auto leading-relaxed">
          Not all screens are created equal. Discover how our custom calibrated laser projection, 
          spatial acoustics, and VIP hospitality redefine modern cinema.
        </p>
      </section>

      {/* Experience Showcase Cards & Interactive Filter */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 w-full">
        <ExperiencesClient />
      </section>
    </main>
  );
}
