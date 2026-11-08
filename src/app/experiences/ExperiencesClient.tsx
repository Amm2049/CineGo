// src/app/experiences/ExperiencesClient.tsx
"use client";

import { useState } from "react";

export interface AuditoriumSpec {
  id: string;
  name: string;
  category: "flagship" | "vip" | "global";
  badge: string;
  spec: string;
  desc: string;
  features: string[];
  highlight: string;
  availability: string;
}

// Facts only: the four theatres and seat prices match prisma/seed.ts. "Elsewhere" formats are not at CineGo.
export const AUDITORIUM_SPECS: AuditoriumSpec[] = [
  {
    id: "imax",
    name: "IMAX with Laser",
    category: "flagship",
    badge: "Biggest picture",
    spec: "4K laser projection · IMAX 12-channel sound",
    desc: "A floor-to-ceiling screen with laser projection for a sharp, bright picture. Films shot for IMAX can show up to 40% more image.",
    features: [
      "4K laser projection",
      "Floor-to-ceiling screen",
      "IMAX 12-channel sound",
      "Expanded picture on selected films",
    ],
    highlight: "Best for big sci-fi and action films",
    availability: "Theatre 1",
  },
  {
    id: "dolby",
    name: "Dolby Cinema",
    category: "flagship",
    badge: "Picture & sound",
    spec: "Dolby Vision HDR · Dolby Atmos",
    desc: "Dolby Vision laser projection gives deep blacks and bright highlights, and Dolby Atmos moves sound around and above you.",
    features: [
      "Dolby Vision HDR laser projection",
      "Dolby Atmos sound, including overhead",
      "Deep blacks and high contrast",
    ],
    highlight: "Best for dark, atmospheric films and big soundtracks",
    availability: "Theatre 2",
  },
  {
    id: "4dx",
    name: "4DX",
    category: "flagship",
    badge: "Motion & effects",
    spec: "Motion seats · wind, water, scent, light",
    desc: "Seats move with the action, while wind, water spray, scents, fog and flashes of light are timed to the film.",
    features: [
      "Seats that tilt, rise and shake",
      "Wind, water spray and fog",
      "Scents timed to scenes",
      "Lightning-style flashes",
    ],
    highlight: "Best for action and adventure films",
    availability: "Theatre 3",
  },
  {
    id: "standard",
    name: "Standard",
    category: "flagship",
    badge: "Classic cinema",
    spec: "Digital projection · surround sound",
    desc: "Our classic theatre: a big screen, surround sound and the same seat choices as every other theatre.",
    features: ["Digital projection", "Surround sound", "Same seat tiers and prices as every theatre"],
    highlight: "Best for dramas, comedies and family films",
    availability: "Theatre 4",
  },
  {
    id: "seats",
    name: "Seat tiers",
    category: "vip",
    badge: "Every theatre",
    spec: "VIP ฿280 · Premium ฿200 · Standard ฿150",
    desc: "Every theatre has 60 seats in rows A–F. The price depends on the row, and you see it on the seat map before you pay.",
    features: ["VIP: rows A–B, ฿280", "Premium: rows C–D, ฿200", "Standard: rows E–F, ฿150"],
    highlight: "Pick your exact seats on the live seat map",
    availability: "Theatres 1–4",
  },
  {
    id: "screenx",
    name: "ScreenX",
    category: "global",
    badge: "270° picture",
    spec: "Picture on three walls",
    desc: "In selected scenes the picture extends onto the left and right walls, so it surrounds you on three sides.",
    features: ["Front screen plus both side walls", "Used for selected scenes", "Needs films made for ScreenX"],
    highlight: "Great for chases and flying scenes",
    availability: "Not at CineGo",
  },
  {
    id: "onyx",
    name: "Samsung Onyx Cinema LED",
    category: "global",
    badge: "LED screen",
    spec: "Self-lit LED screen · no projector",
    desc: "The screen lights itself, like a giant TV, so blacks are truly black and the picture stays bright and sharp from edge to edge.",
    features: ["No projector", "True black", "HDR brightness"],
    highlight: "Best for HDR picture quality",
    availability: "Not at CineGo",
  },
  {
    id: "thx",
    name: "THX Certified Cinema",
    category: "global",
    badge: "Sound standard",
    spec: "Certified sound and picture",
    desc: "THX, created at Lucasfilm in 1983, certifies cinemas that meet strict standards for sound, background noise and picture.",
    features: ["Very low background noise", "Calibrated speakers and screen", "Regular re-certification"],
    highlight: "Best for listeners who care about sound",
    availability: "Not at CineGo",
  },
  {
    id: "dbox",
    name: "D-BOX Motion Seats",
    category: "global",
    badge: "Motion seats",
    spec: "Seats move with the film",
    desc: "Motion designers code each film scene by scene, so the seat pitches, rolls and vibrates with the action. Each seat has its own intensity setting.",
    features: ["Pitch, roll and vibration", "Coded for each film", "Adjustable intensity per seat"],
    highlight: "Best for racing and action films",
    availability: "Not at CineGo",
  },
];

export default function ExperiencesClient() {
  const [activeTab, setActiveTab] = useState<"all" | "flagship" | "global">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSpecs = AUDITORIUM_SPECS.filter((spec) => {
    const matchesTab =
      activeTab === "all"
        ? true
        : activeTab === "flagship"
        ? spec.category === "flagship" || spec.category === "vip"
        : spec.category === "global";

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      spec.name.toLowerCase().includes(q) ||
      spec.spec.toLowerCase().includes(q) ||
      spec.badge.toLowerCase().includes(q) ||
      spec.features.some((f) => f.toLowerCase().includes(q));

    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-10">
      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-[#2500f0]/20">
        {/* Navigation Filter Buttons */}
        <div className="inline-flex p-1.5 rounded-2xl bg-[#070820] border border-[#2500f0]/40">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "all"
                ? "bg-[#2500f0] text-white shadow-[0_0_15px_rgba(37,0,240,0.6)]"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>All</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 text-white/90">
              {AUDITORIUM_SPECS.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("flagship")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "flagship"
                ? "bg-[#2500f0] text-white shadow-[0_0_15px_rgba(37,0,240,0.6)]"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>🍿 At CineGo</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 text-white/90">
              {AUDITORIUM_SPECS.filter((x) => x.category !== "global").length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("global")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "global"
                ? "bg-[#2500f0] text-white shadow-[0_0_15px_rgba(37,0,240,0.6)]"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>🌐 Elsewhere</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 text-white/90">
              {AUDITORIUM_SPECS.filter((x) => x.category === "global").length}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search formats, e.g. Atmos"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-[#070820] border border-white/15 focus:border-[#5938ff] rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#5938ff]"
          />
        </div>
      </div>

      {/* Experience Showcase Cards (3 Columns Layout) */}
      {filteredSpecs.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center space-y-2">
          <p className="text-zinc-300 font-semibold text-sm">No formats match your search.</p>
          <p className="text-zinc-500 text-xs">Try another word.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSpecs.map((spec) => (
            <div
              key={spec.id}
              className="glass-panel-cobalt rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 relative overflow-hidden group hover:border-[#5938ff] transition-all duration-300 shadow-xl"
            >
              <div className="space-y-4">
                {/* Header: Badges */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[10px] sm:text-[11px] uppercase font-black tracking-widest text-[#a5b4fc] bg-[#2500f0]/30 border border-[#2500f0]/50 px-3 py-1 rounded-full">
                    {spec.badge}
                  </span>

                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/[0.06] text-zinc-300 border border-white/10">
                    {spec.availability}
                  </span>
                </div>

                {/* Title & Technical Spec */}
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{spec.name}</h2>
                  <div className="mt-2 text-[11px] sm:text-xs font-mono font-bold text-[#c7d2fe] bg-black/40 p-2.5 rounded-xl border border-white/10">
                    {spec.spec}
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-[#e2e8f0] leading-relaxed">{spec.desc}</p>

                {/* What you get */}
                <div className="space-y-2 pt-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                    What you get
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

              {/* Bottom Card Information Footer (Clean, No CTA Buttons) */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-[#c7d2fe]/90 italic">
                  🎯 {spec.highlight}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
