// scripts/backfill-trailers.ts
// ONE-TIME BACKFILL (2026-11-13): movies imported before the trailer feature have no trailerKey.
// This asks TMDB for every imported movie's trailer, keeps the best one that can play inside our
// page (same rule as the sync), and stores the YouTube id. Only `trailerKey` is touched.
//
//   npm run movies:backfill-trailers             → dry run: lists what would change, changes nothing
//   npm run movies:backfill-trailers -- --apply  → saves the trailers
//
// Movies without a TMDB id, or with no trailer on TMDB, are left alone (no button on their page).

import "dotenv/config";
import prisma from "@/lib/prisma";
import { getMovieDetails, hasTmdbCredentials } from "@/lib/tmdb";
import { pickTrailerKey, withPlayableTrailer } from "@/services/movie-sync.service";

function fail(message: string): never {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    fail("This backfill is for the local database only and refuses to run in production.");
  }
  if (!hasTmdbCredentials()) fail("TMDB credentials are not configured (.env).");
  const apply = process.argv.includes("--apply");

  const movies = await prisma.movie.findMany({
    where: { tmdbId: { not: null } },
    select: { id: true, title: true, tmdbId: true, trailerKey: true },
    orderBy: { title: "asc" },
  });

  const found: { id: string; title: string; key: string | null }[] = [];
  let unchanged = 0;
  const none: string[] = [];
  for (const m of movies) {
    try {
      const key = pickTrailerKey(await withPlayableTrailer(await getMovieDetails(m.tmdbId!)));
      if (key === m.trailerKey) {
        unchanged++;
        if (!key) none.push(`${m.title} (no playable trailer)`);
      } else found.push({ id: m.id, title: m.title, key });
    } catch (err) {
      none.push(`${m.title} (TMDB error: ${err instanceof Error ? err.message : String(err)})`);
    }
  }

  console.log(`\nChecked ${movies.length} movies. To change: ${found.length}. Already right: ${unchanged}.`);
  for (const m of found) console.log(`   • ${m.title}  → ${m.key ? `youtu.be/${m.key}` : "no playable trailer (removed)"}`);
  if (none.length > 0) {
    console.log(`\nNo trailer button:`);
    for (const line of none) console.log(`   • ${line}`);
  }

  if (!apply) {
    console.log(`\nDry run: nothing changed. Re-run with --apply to save them.\n`);
    return;
  }
  let saved = 0;
  for (const m of found) {
    await prisma.movie.update({ where: { id: m.id }, data: { trailerKey: m.key } });
    saved++;
  }
  console.log(`\n✅ Updated ${saved} movies.\n`);
}

main()
  .catch((err) => fail(err instanceof Error ? err.message : String(err)))
  .finally(() => prisma.$disconnect());
