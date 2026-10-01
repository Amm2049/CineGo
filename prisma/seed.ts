// prisma/seed.ts
// CineGo — Database Seed Script
// Supports Live TMDB API Sync with resilient offline fallback
// Generates a 14-day conflict-free rolling showtime schedule

import { prisma } from '../src/lib/prisma';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  hasTmdbCredentials,
  getNowPlayingMovies,
  getUpcomingMovies,
  getMovieDetails,
  getTmdbImageUrl,
  getTmdbGenres,
} from '../src/lib/tmdb';

interface SeedMovieItem {
  tmdbId: number;
  title: string;
  description: string;
  duration: number;
  releaseDate: Date;
  posterUrl: string;
  backdropUrl: string;
  genres: string[];
}

async function main() {
  console.log('🎬 Seeding CineGo database...\n');

  // ── Clean existing data (reverse FK order) ──────────────────
  await prisma.bookingSeat.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.showtime.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.movieGenre.deleteMany();
  await prisma.userInterest.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.genre.deleteMany();
  await prisma.screen.deleteMany();
  await prisma.cinema.deleteMany();
  await prisma.user.deleteMany();
  console.log('🧹 Cleared existing database records.\n');

  // ── 1. Cinema ───────────────────────────────────────────────
  const cinema = await prisma.cinema.create({
    data: {
      name: 'CineGo Flagship',
      location: 'Siam Paragon, Bangkok',
    },
  });
  console.log(`🏛️  Created cinema: ${cinema.name}`);

  // ── 2. Screens ──────────────────────────────────────────────
  const screenNames = ['IMAX Laser', 'Dolby Cinema', '4DX Motion', 'Standard'];
  const screens = [];
  for (const name of screenNames) {
    const screen = await prisma.screen.create({
      data: {
        cinemaId: cinema.id,
        name,
      },
    });
    screens.push(screen);
    console.log(`🖥️  Created screen: ${name}`);
  }

  // ── 3. Seats (Rows A–F, 10 seats/row, row-based pricing) ─────
  //    Premium       (A–B): ฿280
  //    Standard Plus (C–D): ฿200
  //    Standard      (E–F): ฿150
  const rowPricing: Record<string, number> = {
    A: 280,
    B: 280,
    C: 200,
    D: 200,
    E: 150,
    F: 150,
  };

  let totalSeats = 0;
  for (const screen of screens) {
    const seatData: Prisma.SeatCreateManyInput[] = [];
    for (const [rowLabel, price] of Object.entries(rowPricing)) {
      for (let seatNum = 1; seatNum <= 10; seatNum++) {
        seatData.push({
          screenId: screen.id,
          rowLabel,
          seatNum,
          price: new Prisma.Decimal(price),
        });
      }
    }
    await prisma.seat.createMany({ data: seatData });
    totalSeats += seatData.length;
  }
  console.log(`💺 Created ${totalSeats} seats across ${screens.length} screens (Rows A–F, 10 seats/row)\n`);

  // ── 4. Genres ───────────────────────────────────────────────
  const standardGenres = [
    'Action',
    'Adventure',
    'Animation',
    'Comedy',
    'Crime',
    'Documentary',
    'Drama',
    'Family',
    'Fantasy',
    'History',
    'Horror',
    'Music',
    'Mystery',
    'Romance',
    'Sci-Fi',
    'Science Fiction',
    'Thriller',
    'War',
    'Western',
  ];

  const genreMap: Record<string, string> = {};

  if (hasTmdbCredentials()) {
    try {
      console.log('🌐 Fetching official genre taxonomy from TMDB API...');
      const tmdbGenres = await getTmdbGenres();
      for (const g of tmdbGenres) {
        if (!standardGenres.includes(g.name)) {
          standardGenres.push(g.name);
        }
      }
    } catch {
      console.warn('⚠️  Could not fetch TMDB genres online, using standard genre list.');
    }
  }

  for (const name of standardGenres) {
    const genre = await prisma.genre.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    genreMap[name] = genre.id;
  }
  console.log(`🏷️  Created/verified ${standardGenres.length} genres in taxonomy.`);

  // ── 5. Movies (Live TMDB Sync or Curated Fallback) ───────────
  const now = new Date();
  const rawMovies: SeedMovieItem[] = [];

  if (hasTmdbCredentials()) {
    try {
      console.log('\n🌐 Live TMDB API credentials detected! Syncing live movies...');
      const [nowPlayingRes, upcomingRes1, upcomingRes2] = await Promise.all([
        getNowPlayingMovies(1),
        getUpcomingMovies(1),
        getUpcomingMovies(2),
      ]);

      const nowPlayingTop = nowPlayingRes.results.slice(0, 10);
      const nowPlayingIds = new Set(nowPlayingTop.map((m) => m.id));
      const allUpcoming = [...upcomingRes1.results, ...upcomingRes2.results];
      const upcomingTop = allUpcoming
        .filter((m) => !nowPlayingIds.has(m.id))
        .slice(0, 20);

      console.log(`📥 Syncing ${nowPlayingTop.length} Now Playing & ${upcomingTop.length} Upcoming movies...`);

      const [nowPlayingDetails, upcomingDetails] = await Promise.all([
        Promise.all(nowPlayingTop.map((item) => getMovieDetails(item.id).catch(() => null))),
        Promise.all(upcomingTop.map((item) => getMovieDetails(item.id).catch(() => null))),
      ]);

      for (const details of nowPlayingDetails) {
        if (!details) continue;
        let relDate = details.release_date ? new Date(details.release_date) : now;
        if (relDate > now) {
          relDate = now; // Ensure Now Playing qualifies as released
        }

        rawMovies.push({
          tmdbId: details.id,
          title: details.title,
          description: details.overview || details.tagline || 'Experience this blockbuster in theaters.',
          duration: details.runtime && details.runtime > 0 ? details.runtime : 120,
          releaseDate: relDate,
          posterUrl: getTmdbImageUrl(details.poster_path, 'w500'),
          backdropUrl: getTmdbImageUrl(details.backdrop_path, 'original'),
          genres: details.genres.map((g) => (g.name === 'Science Fiction' ? 'Sci-Fi' : g.name)),
        });
      }

      for (const details of upcomingDetails) {
        if (!details) continue;
        let relDate = details.release_date ? new Date(details.release_date) : new Date(now.getTime() + 21 * 86400000);
        if (relDate <= now) {
          relDate = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
        }

        rawMovies.push({
          tmdbId: details.id,
          title: details.title,
          description: details.overview || details.tagline || 'Coming soon exclusively to theaters.',
          duration: details.runtime && details.runtime > 0 ? details.runtime : 125,
          releaseDate: relDate,
          posterUrl: getTmdbImageUrl(details.poster_path, 'w500'),
          backdropUrl: getTmdbImageUrl(details.backdrop_path, 'original'),
          genres: details.genres.map((g) => (g.name === 'Science Fiction' ? 'Sci-Fi' : g.name)),
        });
      }
      console.log(`✅ Successfully fetched ${rawMovies.length} live movies from TMDB API.`);
    } catch (apiError) {
      console.warn('⚠️  TMDB API sync failed, switching to curated offline dataset:', apiError);
      rawMovies.length = 0;
    }
  }

  // Fallback dataset if no API credentials or API call failed
  if (rawMovies.length === 0) {
    console.log('📦 Using curated blockbuster catalog with dynamic rolling release dates.');
    rawMovies.push(
      // Now Showing (released with past release dates)
      {
        tmdbId: 533535,
        title: 'Deadpool & Wolverine',
        description: 'A listless Wade Wilson toils away in civilian life with his days as Deadpool behind him. But when his homeworld faces an existential threat, Wade must reluctantly suit-up again with an even more reluctant Wolverine.',
        duration: 128,
        releaseDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        posterUrl: 'https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/original/by8z9Fe8y7p4jo2YlW2SZDnptyT.jpg',
        genres: ['Action', 'Comedy', 'Sci-Fi'],
      },
      {
        tmdbId: 558449,
        title: 'Gladiator II',
        description: 'Years after witnessing the death of Maximus, Lucius is forced to enter the Colosseum after his home is conquered by tyrannical emperors who lead Rome with an iron fist, fighting to restore glory to the Empire.',
        duration: 148,
        releaseDate: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
        posterUrl: 'https://image.tmdb.org/t/p/w500/2cxhvwyEwRlysAmRH4iodkvo0z5.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/original/tOqIwliWMovSIZ9DyvHcHI7p2im.jpg',
        genres: ['Action', 'Drama'],
      },
      {
        tmdbId: 402431,
        title: 'Wicked',
        description: 'In the land of Oz, misunderstood green-skinned Elphaba forms an unlikely friendship with popular Glinda at Shiz University, tested as they fulfill their respective destinies as Glinda the Good and the Wicked Witch of the West.',
        duration: 161,
        releaseDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        posterUrl: 'https://image.tmdb.org/t/p/w500/xDGbZ0JJ3mYaGKy4Nzd9Kph6M9L.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/original/fyZ6SDUS4o9jp2EHxfZa3qS9ean.jpg',
        genres: ['Fantasy', 'Drama', 'Romance'],
      },
      {
        tmdbId: 1184918,
        title: 'The Wild Robot',
        description: 'After a shipwreck, an intelligent robot called Roz is stranded on an uninhabited island and bonds with the island animals, adopting an orphaned baby goose in a moving tale of survival and connection.',
        duration: 102,
        releaseDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
        posterUrl: 'https://image.tmdb.org/t/p/w500/wTnV3PCVW5O92JMrFvvrRcV39RU.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/original/1pmXyN3sKeYoUhu5VBZiDU4BX21.jpg',
        genres: ['Animation', 'Sci-Fi', 'Drama'],
      },
      {
        tmdbId: 823464,
        title: 'Captain America: Brave New World',
        description: 'Sam Wilson finds himself in the middle of an international incident after meeting with newly elected U.S. President Thaddeus Ross, uncovering a nefarious global plot before the mastermind behind it can plunge the world into chaos.',
        duration: 118,
        releaseDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        posterUrl: 'https://image.tmdb.org/t/p/w500/pzIddUEMWhWzfvLI3TwxUG2wGoi.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/original/by8z9Fe8y7p4jo2YlW2SZDnptyT.jpg',
        genres: ['Action', 'Sci-Fi', 'Thriller'],
      },
      // Upcoming Releases (Dynamically relative into the future -- never expire!)
      {
        tmdbId: 1063877,
        title: 'Superman',
        description: 'Superman, a journalist in Metropolis, embarks on a journey to reconcile his Kryptonian heritage with his human upbringing as Clark Kent in James Gunn new DC Universe vision.',
        duration: 135,
        releaseDate: new Date(now.getTime() + 18 * 24 * 60 * 60 * 1000),
        posterUrl: 'https://image.tmdb.org/t/p/w500/ldyfo0BKmz5rWtJJKCvwaNS4cJT.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/original/yRBc6WY3r1Fz5Cjd6DhSvzqunED.jpg',
        genres: ['Action', 'Sci-Fi'],
      },
      {
        tmdbId: 617126,
        title: 'The Fantastic Four: First Steps',
        description: 'Set against the vibrant backdrop of a 1960s retro-futuristic world, Marvel First Family must balance their roles as superheroes and a tight-knit family while defending Earth against the cosmic entity Galactus.',
        duration: 130,
        releaseDate: new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000),
        posterUrl: 'https://image.tmdb.org/t/p/w500/veiSodk4JS4M2kBZCqBWeEEdMCr.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/original/pwCZP8QjiQRvz15MGxQckW0wl3a.jpg',
        genres: ['Action', 'Sci-Fi', 'Fantasy'],
      },
      {
        tmdbId: 1003596,
        title: 'Avengers: Doomsday',
        description: 'Beloved heroes from distinct universes are set on a deadly collision course and face an existential threat unlike anything they have ever encountered as Doctor Doom rises to reshape reality.',
        duration: 165,
        releaseDate: new Date(now.getTime() + 65 * 24 * 60 * 60 * 1000),
        posterUrl: 'https://image.tmdb.org/t/p/w500/jzPwsojjFStf5lR5Nm07w2hH56G.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/original/s4v0UX1anfXm0UvloLsTTJ4v222.jpg',
        genres: ['Action', 'Sci-Fi', 'Fantasy'],
      }
    );
  }

  // Deduplicate movies by tmdbId to ensure unique constraint satisfaction
  const seenTmdbIds = new Set<number>();
  const uniqueMoviesToSeed: SeedMovieItem[] = [];
  for (const m of rawMovies) {
    if (!seenTmdbIds.has(m.tmdbId)) {
      seenTmdbIds.add(m.tmdbId);
      uniqueMoviesToSeed.push(m);
    }
  }

  const createdMovies = [];
  for (const movieData of uniqueMoviesToSeed) {
    const { genres: genreList, ...data } = movieData;
    const movie = await prisma.movie.upsert({
      where: { tmdbId: data.tmdbId },
      update: { ...data },
      create: { ...data },
    });

    for (const genreName of genreList) {
      let genreId = genreMap[genreName];
      if (!genreId) {
        const newGenre = await prisma.genre.upsert({
          where: { name: genreName },
          update: {},
          create: { name: genreName },
        });
        genreId = newGenre.id;
        genreMap[genreName] = genreId;
      }

      await prisma.movieGenre.upsert({
        where: {
          movieId_genreId: {
            movieId: movie.id,
            genreId,
          },
        },
        update: {},
        create: {
          movieId: movie.id,
          genreId,
        },
      });
    }
    createdMovies.push(movie);
    console.log(`🎬 Created movie: ${movie.title} (tmdbId: ${movie.tmdbId})`);
  }

  // ── 5.1 Dynamic Conflict-Free Cinema Scheduling (14-Day Window) ──
  console.log('\n🎟️  Scheduling conflict-free active showtimes across 14-day rolling window...');
  
  // Find released movies (releaseDate <= now) for active showtime scheduling
  let releasedMovies = createdMovies.filter((m) => m.releaseDate <= now);
  if (releasedMovies.length === 0) {
    releasedMovies = createdMovies.slice(0, 4);
  }

  const CLEANING_BUFFER_MINUTES = 25;
  const SCHEDULE_DAYS = 14; // Full 2-week rolling window
  let totalShowtimes = 0;

  for (let dayOffset = 0; dayOffset < SCHEDULE_DAYS; dayOffset++) {
    for (let screenIndex = 0; screenIndex < screens.length; screenIndex++) {
      const screen = screens[screenIndex];

      // Screen opens at 11:00 AM each day
      const currentTime = new Date();
      currentTime.setDate(currentTime.getDate() + dayOffset);
      currentTime.setHours(11, 0, 0, 0);

      // Last screening must start before 22:30
      const closingTime = new Date(currentTime);
      closingTime.setHours(22, 30, 0, 0);

      let movieIndex = (screenIndex + dayOffset) % releasedMovies.length;

      while (currentTime < closingTime) {
        const movie = releasedMovies[movieIndex];
        const startsAt = new Date(currentTime);
        const endsAt = new Date(startsAt.getTime() + movie.duration * 60 * 1000);

        await prisma.showtime.create({
          data: {
            movieId: movie.id,
            screenId: screen.id,
            startsAt,
            endsAt,
          },
        });
        totalShowtimes++;

        // Next screening starts after duration + cleaning buffer
        currentTime.setTime(endsAt.getTime() + CLEANING_BUFFER_MINUTES * 60 * 1000);

        // Round up to nearest 5 minutes for clean intervals
        const remainderMinutes = currentTime.getMinutes() % 5;
        if (remainderMinutes !== 0) {
          currentTime.setMinutes(currentTime.getMinutes() + (5 - remainderMinutes));
        }

        movieIndex = (movieIndex + 1) % releasedMovies.length;
      }
    }
  }
  console.log(`✅ Created ${totalShowtimes} conflict-free showtimes across ${screens.length} screens for the next ${SCHEDULE_DAYS} days.`);

  // Automated Conflict Verification Assertion across all screens
  const allShowtimes = await prisma.showtime.findMany({
    orderBy: [{ screenId: 'asc' }, { startsAt: 'asc' }],
  });

  let conflictCount = 0;
  for (let i = 0; i < allShowtimes.length - 1; i++) {
    const current = allShowtimes[i];
    const next = allShowtimes[i + 1];
    if (current.screenId === next.screenId && current.endsAt > next.startsAt) {
      console.error(
        `❌ Overlap on screen ${current.screenId}: [${current.startsAt.toLocaleTimeString()} - ${current.endsAt.toLocaleTimeString()}] overlaps with [${next.startsAt.toLocaleTimeString()} - ${next.endsAt.toLocaleTimeString()}]`
      );
      conflictCount++;
    }
  }

  if (conflictCount === 0) {
    console.log('🛡️  Verified: 0 showtime conflicts detected across all screens!\n');
  } else {
    throw new Error(`Scheduling conflict check failed: ${conflictCount} overlapping showtimes found.`);
  }

  // ── 6. Admin User ───────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash('admin123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@cinego.com' },
    update: {},
    create: {
      email: 'admin@cinego.com',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });
  console.log('👤 Admin user created: admin@cinego.com / admin123');

  console.log('\n✨ Seeding complete!');
  console.log('   Run `npx prisma studio` to inspect the data.\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
