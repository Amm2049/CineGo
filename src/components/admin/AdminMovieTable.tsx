"use client";

import { useState } from "react";
import Image from "next/image";
import type { AdminMovieRow } from "@/services/admin.service";

interface Props {
  movies: AdminMovieRow[];
  busy: boolean;
  onChanged: (message: string) => void;
  onError: (message: string) => void;
}

export default function AdminMovieTable({ movies, busy, onChanged, onError }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", description: "" });
  const [savingId, setSavingId] = useState<string | null>(null);

  async function patchMovie(id: string, body: Record<string, unknown>, successMessage: string) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/movies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? "Update failed");
        return false;
      }
      onChanged(successMessage); // parent calls router.refresh(): the DB stays the one source of truth
      return true;
    } catch {
      onError("Network error while saving");
      return false;
    } finally {
      setSavingId(null);
    }
  }

  function startEdit(movie: AdminMovieRow) {
    setEditingId(movie.id);
    setDraft({ title: movie.title, description: movie.description });
  }

  async function saveEdit(id: string) {
    if (await patchMovie(id, draft, "Movie details saved")) setEditingId(null);
  }

  const btn = "rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-zinc-400">
          <tr>
            <th className="px-4 py-3">Movie</th>
            <th className="px-4 py-3">Release</th>
            <th className="px-4 py-3">Showtimes</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {movies.map((movie) => (
            <tr key={movie.id} className={movie.isActive ? "" : "opacity-60"}>
              <td className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <Image src={movie.posterUrl} alt="" width={36} height={54} className="rounded object-cover" />
                  {editingId === movie.id ? (
                    <div className="flex-1 space-y-2">
                      <input
                        aria-label="Title"
                        value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-white"
                      />
                      <textarea
                        aria-label="Description"
                        rows={3}
                        value={draft.description}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-white"
                      />
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-white">{movie.title}</p>
                      <p className="text-xs text-zinc-500">
                        TMDB #{movie.tmdbId ?? "—"} · {movie.duration} min
                      </p>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-zinc-300">{movie.releaseDate.slice(0, 10)}</td>
              <td className={`px-4 py-3 ${movie.upcomingShowtimes === 0 ? "text-amber-300" : "text-zinc-300"}`}>
                {movie.upcomingShowtimes === 0 ? "None scheduled" : movie.upcomingShowtimes}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    movie.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-500/20 text-zinc-300"
                  }`}
                >
                  {movie.isActive ? "Active" : "Hidden"}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  {editingId === movie.id ? (
                    <>
                      <button type="button" onClick={() => saveEdit(movie.id)} disabled={savingId === movie.id}
                        className={`${btn} bg-[#2500f0] text-white`}>
                        {savingId === movie.id ? "Saving…" : "Save"}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className={`${btn} text-zinc-300 hover:bg-white/10`}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => startEdit(movie)} disabled={busy}
                        className={`${btn} text-[#c7d2fe] hover:bg-white/10`}>
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy || savingId === movie.id}
                        onClick={() =>
                          patchMovie(
                            movie.id,
                            { isActive: !movie.isActive },
                            movie.isActive ? `“${movie.title}” hidden` : `“${movie.title}” is active`
                          )
                        }
                        className={`${btn} border border-white/15 text-white hover:bg-white/10`}
                      >
                        {movie.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
