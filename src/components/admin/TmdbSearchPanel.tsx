"use client";

import { useEffect, useEffectEvent, useState } from "react";
import Image from "next/image";
import type { AdminSearchResult } from "@/services/movie-sync.service";

interface Props {
  disabled: boolean;
  onImported: (title: string) => void;
  onError: (message: string) => void;
}

export default function TmdbSearchPanel({ disabled, onImported, onError }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);

  // Lets the effect call the latest onError without re-running when it changes
  const reportError = useEffectEvent((message: string) => onError(message));

  // Debounced search: wait 400 ms after the last keystroke, cancel stale requests
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/movies/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Search failed");
        setResults(data.results);
      } catch (err) {
        if (!controller.signal.aborted) {
          reportError(err instanceof Error ? err.message : "Search failed");
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  async function handleImport(result: AdminSearchResult) {
    setImportingId(result.tmdbId);
    try {
      const res = await fetch("/api/admin/movies/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: result.tmdbId }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? "Import failed");
        return;
      }
      setResults((list) =>
        list.map((r) => (r.tmdbId === result.tmdbId ? { ...r, alreadyImported: true } : r))
      );
      onImported(data.title ?? result.title);
    } catch {
      onError("Network error during import");
    } finally {
      setImportingId(null);
    }
  }

  const showResults = query.trim().length >= 2;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-lg font-bold text-white">Import from TMDB</h2>
      <label htmlFor="tmdb-search" className="sr-only">
        Search TMDB
      </label>
      <input
        id="tmdb-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        placeholder="Search by title, e.g. Dune"
        className="mt-3 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-[#5938ff] focus:outline-none"
      />
      {showResults && searching && <p className="mt-3 text-sm text-zinc-400">Searching…</p>}
      {showResults && !searching && results.length === 0 && (
        <p className="mt-3 text-sm text-zinc-400">No results.</p>
      )}
      {showResults && results.length > 0 && (
        <ul className="mt-4 divide-y divide-white/5">
          {results.map((r) => (
            <li key={r.tmdbId} className="flex items-center gap-3 py-2.5">
              {r.posterUrl ? (
                <Image src={r.posterUrl} alt="" width={36} height={54} className="rounded object-cover" />
              ) : (
                <div className="h-[54px] w-9 rounded bg-white/10" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">{r.title}</p>
                <p className="text-xs text-zinc-400">
                  {r.releaseDate ?? "Release date unknown"} · TMDB #{r.tmdbId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleImport(r)}
                disabled={importingId !== null}
                className="rounded-lg border border-[#5938ff]/60 px-3 py-1.5 text-xs font-bold text-[#c7d2fe] hover:bg-[#2500f0]/30 disabled:opacity-50"
              >
                {importingId === r.tmdbId ? "Importing…" : r.alreadyImported ? "Re-sync" : "Import"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
