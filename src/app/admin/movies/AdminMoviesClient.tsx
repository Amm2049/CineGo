"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
// Type-only imports are erased at build time, so Prisma never reaches the browser
import type { AdminMovieRow } from "@/services/admin.service";
import type { SyncSummary } from "@/services/movie-sync.service";
import { useToasts, ToastStack } from "@/components/admin/Toasts";
import TmdbSearchPanel from "@/components/admin/TmdbSearchPanel";
import AdminMovieTable from "@/components/admin/AdminMovieTable";

interface Props {
  movies: AdminMovieRow[];
  tmdbConfigured: boolean;
}

export default function AdminMoviesClient({ movies, tmdbConfigured }: Props) {
  const router = useRouter();
  const { toasts, push } = useToasts();
  const [syncing, setSyncing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isRefreshing, startRefresh] = useTransition();

  // Live progress: count seconds while the sync request is running
  useEffect(() => {
    if (!syncing) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, [syncing]);

  function refresh() {
    startRefresh(() => router.refresh()); // re-runs page.tsx on the server
  }

  async function handleSyncAll() {
    setElapsed(0);
    setSyncing(true);
    push("info", "Syncing latest releases from TMDB…");
    try {
      const res = await fetch("/api/admin/movies/sync-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        push("error", data.error ?? "Sync failed");
        return;
      }
      const s: SyncSummary = data.summary;
      push(
        s.failed > 0 ? "error" : "success",
        `Synced ${s.created + s.updated} titles: ${s.created} new, ${s.updated} updated` +
          (s.skipped > 0 ? `, ${s.skipped} re-releases skipped` : "") +
          (s.failed > 0 ? `, ${s.failed} failed` : "")
      );
      refresh();
    } catch {
      push("error", "Network error during sync");
    } finally {
      setSyncing(false);
    }
  }

  const activeCount = movies.filter((m) => m.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Movies</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {movies.length} imported · {activeCount} active
          </p>
        </div>
        <button
          type="button"
          onClick={handleSyncAll}
          disabled={syncing || !tmdbConfigured}
          className="btn-cobalt rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-50"
        >
          {syncing ? `Syncing… ${elapsed}s` : "⚡ Sync Latest Releases"}
        </button>
      </div>

      {syncing && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[#5938ff]" />
        </div>
      )}

      {!tmdbConfigured && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          TMDB credentials are missing on the server. Set TMDB_READ_ACCESS_TOKEN to enable sync and search.
        </p>
      )}

      <TmdbSearchPanel
        disabled={!tmdbConfigured}
        onImported={(title) => {
          push("success", `Imported “${title}”`);
          refresh();
        }}
        onError={(message) => push("error", message)}
      />

      <AdminMovieTable
        movies={movies}
        busy={syncing || isRefreshing}
        onChanged={(message) => {
          push("success", message);
          refresh();
        }}
        onError={(message) => push("error", message)}
      />

      <ToastStack toasts={toasts} />
    </div>
  );
}
