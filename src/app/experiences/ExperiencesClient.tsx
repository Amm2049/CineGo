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

export const AUDITORIUM_SPECS: AuditoriumSpec[] = [
  {
    id: "imax",
    name: "IMAX® with Laser",
    category: "flagship",
    badge: "Maximum Immersion",
    spec: "Dual 4K Laser Projection · 1.43:1 Expanded Aspect Ratio",
    desc: "Experience up to 40% more picture with unparalleled laser sharpness and a custom 12-channel soundstage tuned for visceral physical resonance.",
    features: [
      "Next-Gen 4K Laser Optical Engine",
      "Sub-bass Transducers in Every Seat",
      "Floor-to-Ceiling Curved Canvas",
      "Laser-Aligned Digital Audio",
    ],
    highlight: "Best for Sci-Fi blockbusters and cinematic epics",
    availability: "Flagship Hall 1",
  },
  {
    id: "dolby",
    name: "Dolby Cinema & Atmos®",
    category: "flagship",
    badge: "Acoustic & Visual Mastery",
    spec: "64-Channel Spatial Audio · Dolby Vision Dual 4K HDR",
    desc: "Individual sound elements flow dynamically above and around you with true obsidian blacks and a 1,000,000:1 dynamic contrast ratio.",
    features: [
      "Object-Based Spatial Sound Elements",
      "Dual 4K Christie Laser Projectors",
      "Zero-Spill Matte Black Interior",
      "Dolby Vision High Dynamic Range",
    ],
    highlight: "Best for acoustic mastery and dramatic contrast",
    availability: "Flagship Hall 2",
  },
  {
    id: "4dx",
    name: "4DX Motion & Effects",
    category: "flagship",
    badge: "Sensory Immersion",
    spec: "Synchronized Motion Seats · Atmospheric FX",
    desc: "Step beyond the screen with active motion seats synchronized with on-screen action, wind turbulence, water mist, scents, and strobe flashes.",
    features: [
      "3-DOF Hydraulic Motion Simulators",
      "In-Theater Wind & Rain Simulators",
      "Dynamic Environmental Scent Delivery",
      "Lightning & Fog Simulation Systems",
    ],
    highlight: "Best for high-octane action and thrillers",
    availability: "Flagship Hall 3",
  },
  {
    id: "vip",
    name: "The Director's Lounge",
    category: "vip",
    badge: "VIP Hospitality",
    spec: "Motorized Zero-Gravity Recliners · In-Seat Dining",
    desc: "Curated for uncompromising luxury. Enjoy in-theatre artisanal dining and handcrafted refreshments delivered silently to your personal private pod.",
    features: [
      "Heated Italian Leather Recliners",
      "Acoustic Privacy Isolation Pods",
      "Call-Button At-Seat Waiter Service",
      "Artisanal Dining & Champagne Menu",
    ],
    highlight: "Best for romantic dates and luxury relaxation",
    availability: "Private Suites & Lounge",
  },
  {
    id: "screenx",
    name: "ScreenX® 270° Panoramic",
    category: "global",
    badge: "270° Panoramic Canvas",
    spec: "Multi-Projection Array · 270° Triple-Wall Immersion",
    desc: "Expands cinematic storytelling beyond the traditional frame by utilizing the left and right auditorium walls, surrounding your peripheral vision with visual action.",
    features: [
      "Multi-Array Laser Projector Blending",
      "Proprietary Panoramic Color Alignment",
      "Active Side-Wall Scene Extension",
      "Synchronized Spatial Surround Tuning",
    ],
    highlight: "Best for aerial sequences, speed chases, and wide spectacles",
    availability: "Global Benchmark",
  },
  {
    id: "onyx",
    name: "Samsung Onyx® Cinema LED",
    category: "global",
    badge: "Direct-View Quantum LED",
    spec: "4K DCI-Compliant Active LED · True Infinite Contrast",
    desc: "Eliminates traditional projection entirely with self-illuminating cinema LED modules. Delivers true 0-nit obsidian blacks, 300 nits peak HDR brightness, and distortion-free geometry.",
    features: [
      "100% DCI-P3 Color Accuracy",
      "Infinite Contrast Ratio (0.0005 to 300+ nits)",
      "Meyer Sound / JBL Sculpted Audio Array",
      "Active 3D Without Dimming or Crosstalk",
    ],
    highlight: "Best for ultra-sharp HDR visual masterpieces",
    availability: "Global Benchmark",
  },
  {
    id: "thx",
    name: "THX® Ultimate Cinema",
    category: "global",
    badge: "Studio Audio Reference",
    spec: "NC-30 Acoustic Isolation · Dual 4K Laser Projection",
    desc: "The legendary acoustic standard founded by George Lucas. Every architectural baffle, acoustic dampening panel, and speaker crossover is calibrated to match Hollywood studio dubbing stages.",
    features: [
      "NC-30 Architectural Noise Criterion",
      "Precision RT60 Reverberation Tuning",
      "Floating Wall Acoustic Isolation",
      "Baffle-Mounted Sub-Bass Line Arrays",
    ],
    highlight: "Best for audiophiles and master orchestral scores",
    availability: "Global Benchmark",
  },
  {
    id: "dbox",
    name: "D-BOX® Haptic Motion",
    category: "global",
    badge: "Micro-Telemetry Haptics",
    spec: "Sub-Millimeter Actuators · Studio-Coded Telemetry",
    desc: "Hollywood studio directors program frame-by-frame motion code into the film, transmitting true physical G-forces, subtle engine vibrations, and spatial pitch directly through the seat.",
    features: [
      "Sub-Millimeter Precision Actuators",
      "Studio Direct Telemetry Encoding",
      "Pitch, Roll & Heave Motion Dynamics",
      "Individual Intensity Controller",
    ],
    highlight: "Best for racing films, flight sims, and visceral action",
    availability: "Global Benchmark",
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
            <span>All Standards</span>
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
            <span>🍿 CineGo Flagship</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 text-white/90">
              4
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
            <span>🌐 Global Showcase</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 text-white/90">
              4
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search technology, audio, or display..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-[#070820] border border-white/15 focus:border-[#5938ff] rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#5938ff]"
          />
        </div>
      </div>

      {/* Experience Showcase Cards (3 Columns Layout) */}
      {filteredSpecs.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center space-y-2">
          <p className="text-zinc-300 font-semibold text-sm">No cinema standards found.</p>
          <p className="text-zinc-500 text-xs">Try adjusting your search query.</p>
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

                {/* Key Specifications List */}
                <div className="space-y-2 pt-1">
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
