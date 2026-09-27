// src/app/(customer)/profile/ProfileClient.tsx
"use client";

import { useState } from "react";

interface GenreItem {
  id: string;
  name: string;
}

interface ProfileClientProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: string;
  };
  allGenres: GenreItem[];
  initialSelectedGenreIds: string[];
}

export default function ProfileClient({
  user,
  allGenres,
  initialSelectedGenreIds,
}: ProfileClientProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedGenreIds);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const toggleGenre = (genreId: string) => {
    setSelectedIds((prev) =>
      prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/user/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genreIds: selectedIds }),
      });

      if (!res.ok) throw new Error("Failed to save preferences");

      setStatusMessage({
        type: "success",
        text: "Preferences saved successfully! AI will use these to match movies.",
      });
    } catch {
      setStatusMessage({
        type: "error",
        text: "Unable to save preferences. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const formattedJoinDate = new Date(user.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
          Account &amp; Preferences
        </h1>
        <p className="text-xs sm:text-sm text-[#c7d2fe] mt-1">
          Customize your profile and genre tastes to power AI recommendation match scores.
        </p>
      </div>

      {/* Account Info Card */}
      <div className="glass-panel-cobalt rounded-2xl p-6 sm:p-7 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#a5b4fc]">
          Member Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="bg-black/40 p-3.5 rounded-xl border border-white/10">
            <span className="text-zinc-400 block text-[11px] mb-1">Display Name</span>
            <span className="font-bold text-white text-sm">{user.name}</span>
          </div>

          <div className="bg-black/40 p-3.5 rounded-xl border border-white/10">
            <span className="text-zinc-400 block text-[11px] mb-1">Email Address</span>
            <span className="font-bold text-white text-sm truncate block">{user.email}</span>
          </div>

          <div className="bg-black/40 p-3.5 rounded-xl border border-white/10">
            <span className="text-zinc-400 block text-[11px] mb-1">Membership Role</span>
            <span className="font-bold text-emerald-400 uppercase tracking-wider text-xs">
              {user.role}
            </span>
          </div>

          <div className="bg-black/40 p-3.5 rounded-xl border border-white/10">
            <span className="text-zinc-400 block text-[11px] mb-1">Member Since</span>
            <span className="font-bold text-white text-xs">{formattedJoinDate}</span>
          </div>
        </div>
      </div>

      {/* Genre Preferences Selection Card */}
      <div className="glass-panel-cobalt rounded-2xl p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#a5b4fc] flex items-center gap-2">
              <span>Favorite Movie Genres</span>
              <span className="text-[11px] text-amber-400 font-semibold lowercase">
                (powers Phase 5 AI engine)
              </span>
            </h2>
            <p className="text-xs text-zinc-300 mt-0.5">
              Click genres you love. Selected: {selectedIds.length}
            </p>
          </div>
        </div>

        {/* Multi-Select Pills Grid */}
        <div className="flex flex-wrap gap-2.5 pt-2">
          {allGenres.map((genre) => {
            const isSelected = selectedIds.includes(genre.id);
            return (
              <button
                key={genre.id}
                type="button"
                onClick={() => toggleGenre(genre.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? "bg-[#2500f0] text-white border border-[#5938ff] shadow-[0_0_12px_rgba(37,0,240,0.6)] scale-105"
                    : "bg-[#070820] text-zinc-400 border border-white/15 hover:border-white/30 hover:text-white"
                }`}
              >
                <span>{isSelected ? "✓" : "+"}</span>
                <span>{genre.name}</span>
              </button>
            );
          })}
        </div>

        {/* Feedback alert */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold ${
              statusMessage.type === "success"
                ? "bg-emerald-950/80 text-emerald-200 border border-emerald-500/40"
                : "bg-red-950/80 text-red-200 border border-red-500/40"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-3 border-t border-white/10 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="btn-cobalt text-xs font-bold px-6 py-2.5 rounded-xl disabled:opacity-50"
          >
            {saving ? "Saving Preferences..." : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}
