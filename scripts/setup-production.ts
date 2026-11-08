// scripts/setup-production.ts
// First-time setup of the PRODUCTION database (the seed is for development only: it wipes everything).
// Safe to re-run: it never deletes or overwrites anything, it only adds what is missing.
//
//   npm run setup:production              → dry run: shows what exists and what would be added
//   npm run setup:production -- --apply   → adds it
//
// Needs in .env:
//   PROD_DATABASE_URL       production database (pooled URL)
//   PROD_ADMIN_PASSWORD     password for admin@cinego.com   (only used if that account doesn't exist yet)
//   PROD_STAFF_PASSWORD     password for staff@cinego.com   (same)
//   TMDB_READ_ACCESS_TOKEN  for the movie import
//
// What --apply adds (only if missing):
//   1. Cinema "CineGo Flagship" with Theatres 1–4 (IMAX Laser, Dolby Cinema, 4DX Motion, Standard)
//   2. 60 seats per theatre: rows A–B ฿280 (VIP), C–D ฿200 (Premium), E–F ฿150 (Standard)
//   3. The TMDB genre list (Science Fiction saved as Sci-Fi)
//   4. Admin and staff accounts
//   5. Movies: the same TMDB sync as the admin "Sync Latest Releases" button
//   6. Showtimes for the next 7 days: 3 shows per theatre per day (~12:00, 16:00, 20:00 Bangkok, 25-min cleaning buffer),
//      only for theatre-days that have no showtimes yet

import "dotenv/config";
import bcrypt from "bcryptjs";

const apply = process.argv.includes("--apply");
const strip = (v?: string) => (v ?? "").trim().replace(/^['"]|['"]$/g, "");

const SCREEN_FORMATS = ["IMAX Laser", "Dolby Cinema", "4DX Motion", "Standard"];
const ROW_PRICES: Record<string, number> = { A: 280, B: 280, C: 200, D: 200, E: 150, F: 150 };
const SEATS_PER_ROW = 10;
const SCHEDULE_DAYS = 7;
const MOVIES_IN_ROTATION = 8;
// A light schedule: 3 shows per theatre per day. A show starts at its slot, or later if the
// previous show (plus the cleaning buffer) runs past it.
const SHOW_SLOTS = ["12:00", "16:00", "20:00"];

function fail(message: string): never {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

async function main() {
  const prodUrl = strip(process.env.PROD_DATABASE_URL);
  if (!prodUrl) fail("PROD_DATABASE_URL is not set in .env.");
  // Point the app's Prisma client at production BEFORE anything imports it
  process.env.DATABASE_URL = prodUrl;

  const { default: prisma } = await import("@/lib/prisma");
  const { Prisma } = await import("@prisma/client");
  const { getTmdbGenres, hasTmdbCredentials } = await import("@/lib/tmdb");
  const { syncLatestReleases, normalizeGenreName } = await import("@/services/movie-sync.service");
  const { addCinemaDays, cinemaLocalToDate, computeEndsAt, todayInCinemaTz, CLEANING_BUFFER_MINUTES } =
    await import("@/lib/schedule");

  try {
    const host = new URL(prodUrl).host;
    console.log(`\nTarget database: ${host}`);
    console.log(apply ? "Mode: APPLY (adds what is missing)\n" : "Mode: dry run (changes nothing)\n");

    // ── Current state ──
    const [cinema, users, movies, futureShows] = await Promise.all([
      prisma.cinema.findFirst({ where: { name: "CineGo Flagship" }, include: { screens: { include: { _count: { select: { seats: true } } } } } }),
      prisma.user.findMany({ where: { email: { in: ["admin@cinego.com", "staff@cinego.com"] } }, select: { email: true } }),
      prisma.movie.count(),
      prisma.showtime.count({ where: { startsAt: { gte: new Date() } } }),
    ]);
    const existingEmails = new Set(users.map((u) => u.email));
    console.log(`Cinema:    ${cinema ? `exists, ${cinema.screens.length} theatres, ${cinema.screens.reduce((n, s) => n + s._count.seats, 0)} seats` : "missing"}`);
    console.log(`Accounts:  admin ${existingEmails.has("admin@cinego.com") ? "exists" : "missing"}, staff ${existingEmails.has("staff@cinego.com") ? "exists" : "missing"}`);
    console.log(`Movies:    ${movies}`);
    console.log(`Showtimes: ${futureShows} upcoming`);

    const adminPassword = strip(process.env.PROD_ADMIN_PASSWORD);
    const staffPassword = strip(process.env.PROD_STAFF_PASSWORD);
    const needAdmin = !existingEmails.has("admin@cinego.com");
    const needStaff = !existingEmails.has("staff@cinego.com");
    if (needAdmin && adminPassword.length < 8) fail("Set PROD_ADMIN_PASSWORD (8+ characters) in .env.");
    if (needStaff && staffPassword.length < 8) fail("Set PROD_STAFF_PASSWORD (8+ characters) in .env.");
    if (!hasTmdbCredentials()) fail("TMDB credentials are missing in .env.");

    if (!apply) {
      console.log("\nDry run: nothing changed. Re-run with --apply to add what is missing.\n");
      return;
    }

    // ── 1–2. Cinema, theatres, seats ──
    const theCinema =
      cinema ?? (await prisma.cinema.create({ data: { name: "CineGo Flagship", location: "Siam Paragon, Bangkok" } }));
    const screens = [];
    for (const [i, format] of SCREEN_FORMATS.entries()) {
      const number = i + 1;
      const screen = await prisma.screen.upsert({
        where: { cinemaId_number: { cinemaId: theCinema.id, number } },
        update: {},
        create: { cinemaId: theCinema.id, number, name: `Theatre ${number}`, format },
      });
      const seatCount = await prisma.seat.count({ where: { screenId: screen.id } });
      if (seatCount === 0) {
        const seats = Object.entries(ROW_PRICES).flatMap(([rowLabel, price]) =>
          Array.from({ length: SEATS_PER_ROW }, (_, k) => ({
            screenId: screen.id,
            rowLabel,
            seatNum: k + 1,
            price: new Prisma.Decimal(price),
          }))
        );
        await prisma.seat.createMany({ data: seats });
      }
      screens.push(screen);
    }
    console.log(`\n✅ Cinema with ${screens.length} theatres and seats ready`);

    // ── 3. Genres ──
    const genres = Array.from(new Set((await getTmdbGenres()).map((g) => normalizeGenreName(g.name))));
    const { count: newGenres } = await prisma.genre.createMany({
      data: genres.map((name) => ({ name })),
      skipDuplicates: true,
    });
    console.log(`✅ Genres: ${newGenres} added (${genres.length} in total)`);

    // ── 4. Accounts (never overwrites an existing password) ──
    for (const [email, role, password, needed] of [
      ["admin@cinego.com", "ADMIN", adminPassword, needAdmin],
      ["staff@cinego.com", "STAFF", staffPassword, needStaff],
    ] as const) {
      if (!needed) continue;
      await prisma.user.create({ data: { email, role, passwordHash: await bcrypt.hash(password, 12) } });
      console.log(`✅ Created ${role.toLowerCase()} account ${email}`);
    }

    // ── 5. Movies ──
    console.log("⏳ Importing movies from TMDB (about a minute)…");
    const sync = await syncLatestReleases();
    console.log(`✅ Movies: ${sync.created} added, ${sync.updated} updated, ${sync.skipped} re-releases skipped, ${sync.failed} failed`);

    // ── 6. Showtimes for theatre-days that have none yet ──
    const now = new Date();
    const rotation = await prisma.movie.findMany({
      where: { isActive: true, releaseDate: { lte: now } },
      orderBy: [{ popularity: "desc" }, { releaseDate: "desc" }],
      take: MOVIES_IN_ROTATION,
      select: { id: true, duration: true },
    });
    if (rotation.length === 0) {
      console.log("⚠️  No released movies to schedule. Add showtimes in Admin → Showtimes later.");
    } else {
      const today = todayInCinemaTz(now);
      const earliest = new Date(now.getTime() + 30 * 60_000); // nothing that starts in the next 30 min
      let created = 0;
      for (let d = 0; d < SCHEDULE_DAYS; d++) {
        const day = addCinemaDays(today, d);
        const dayStart = cinemaLocalToDate(`${day}T00:00`);
        const dayEnd = cinemaLocalToDate(`${addCinemaDays(day, 1)}T00:00`);
        for (const [s, screen] of screens.entries()) {
          const existing = await prisma.showtime.count({
            where: { screenId: screen.id, startsAt: { gte: dayStart, lt: dayEnd } },
          });
          if (existing > 0) continue; // never add to a day that is already scheduled
          let m = (s + d) % rotation.length;
          let nextFree = 0; // earliest time the theatre is clean again
          const rows = [];
          for (const slot of SHOW_SLOTS) {
            const movie = rotation[m];
            const t = new Date(Math.max(cinemaLocalToDate(`${day}T${slot}`).getTime(), nextFree));
            const endsAt = computeEndsAt(t, movie.duration);
            if (t >= earliest) rows.push({ movieId: movie.id, screenId: screen.id, startsAt: t, endsAt });
            // cleaning buffer, rounded up to 5 minutes
            const next = endsAt.getTime() + CLEANING_BUFFER_MINUTES * 60_000;
            nextFree = Math.ceil(next / (5 * 60_000)) * 5 * 60_000;
            m = (m + 1) % rotation.length;
          }
          if (rows.length > 0) created += (await prisma.showtime.createMany({ data: rows })).count;
        }
      }
      console.log(`✅ Showtimes: ${created} added for the next ${SCHEDULE_DAYS} days`);
    }

    console.log("\n✨ Production setup complete.\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
