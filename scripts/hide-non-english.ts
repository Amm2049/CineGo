// scripts/hide-non-english.ts
// ONE-TIME CLEANUP (Phase 10): the bulk sync now keeps English-language films only. This hides the
// active movies imported before that change whose TMDB original language is not English.
//
//   npm run movies:hide-non-english             → dry run: lists what would be hidden, changes nothing
//   npm run movies:hide-non-english -- --apply  → hides them (isActive = false)
//
// Hiding, not deleting: tickets already sold stay valid and scannable, and an admin can re-activate
// any title in Admin → Movies. Movies without a TMDB id are left alone.

import "dotenv/config";
import prisma from "@/lib/prisma";
import { getMovieDetails, hasTmdbCredentials } from "@/lib/tmdb";
import { SYNC_ORIGINAL_LANGUAGE } from "@/services/movie-sync.service";

function fail(message: string): never {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    fail("This cleanup is for the local database only and refuses to run in production.");
  }
  if (!hasTmdbCredentials()) fail("TMDB credentials are not configured (.env).");
  const apply = process.argv.includes("--apply");

  const movies = await prisma.movie.findMany({
    where: { isActive: true },
    select: { id: true, title: true, tmdbId: true },
    orderBy: { title: "asc" },
  });

  const toHide: { id: string; title: string; language: string }[] = [];
  const unchecked: string[] = [];
  for (const m of movies) {
    if (m.tmdbId == null) {
      unchecked.push(`${m.title} (no TMDB id)`);
      continue;
    }
    try {
      const details = await getMovieDetails(m.tmdbId);
      const language = details.original_language ?? "?";
      if (language !== SYNC_ORIGINAL_LANGUAGE) toHide.push({ id: m.id, title: m.title, language });
    } catch (err) {
      unchecked.push(`${m.title} (TMDB error: ${err instanceof Error ? err.message : String(err)})`);
    }
  }

  console.log(`\nChecked ${movies.length} active movies. Not English: ${toHide.length}.`);
  for (const m of toHide) console.log(`   • ${m.title}  [${m.language}]`);
  if (unchecked.length > 0) {
    console.log(`\nLeft alone (could not check):`);
    for (const line of unchecked) console.log(`   • ${line}`);
  }

  if (!apply) {
    console.log(`\nDry run: nothing changed. Re-run with --apply to hide them.\n`);
    return;
  }
  if (toHide.length > 0) {
    const { count } = await prisma.movie.updateMany({
      where: { id: { in: toHide.map((m) => m.id) }, isActive: true },
      data: { isActive: false },
    });
    console.log(`\n✅ Hid ${count} movies. Re-activate any of them in Admin → Movies.\n`);
  } else {
    console.log(`\n✅ Nothing to hide.\n`);
  }
}

main()
  .catch((err) => fail(err instanceof Error ? err.message : String(err)))
  .finally(() => prisma.$disconnect());
