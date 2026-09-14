// prisma/seed.ts
// CineGo — Database Seed Script (Phase 2)
// Idempotent: safe to re-run (deletes existing data first)

import { prisma } from '../src/lib/prisma';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Seeding CineGo database...\n');

  // ── Clean existing data (reverse FK order) ──────────────
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
  console.log('🗑️  Cleared existing data.\n');

  // ── 1. Cinema ───────────────────────────────────────────
  const cinema = await prisma.cinema.create({
    data: {
      name: 'CineGo Flagship',
      location: 'Siam Paragon, Bangkok',
    },
  });
  console.log(`🎬 Created cinema: ${cinema.name}`);

  // ── 2. Screens ──────────────────────────────────────────
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

  // ── 3. Seats (Rows A–F, 10 seats/row, row-based pricing) ──
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

  // ── 4. Genres ───────────────────────────────────────────
  const genreNames = [
    'Action',
    'Comedy',
    'Drama',
    'Horror',
    'Sci-Fi',
    'Romance',
    'Thriller',
    'Animation',
    'Fantasy',
    'Documentary',
  ];

  const genres: Record<string, string> = {};
  for (const name of genreNames) {
    const genre = await prisma.genre.create({ data: { name } });
    genres[name] = genre.id;
  }
  console.log(`🎭 Created ${genreNames.length} genres: ${genreNames.join(', ')}`);

  // ── 5. Movies ───────────────────────────────────────────
  const now = new Date();
  const movies = [
    // Now Screening (real recent blockbusters currently in cinemas)
    {
      title: 'Deadpool & Wolverine',
      description: 'A listless Wade Wilson toils away in civilian life with his days as Deadpool behind him. But when his homeworld faces an existential threat, Wade must reluctantly suit-up again with an even more reluctant Wolverine.',
      duration: 128,
      releaseDate: new Date(2024, 6, 26),
      posterUrl: 'https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/original/by8z9Fe8y7p4jo2YlW2SZDnptyT.jpg',
      genres: ['Action', 'Comedy', 'Sci-Fi'],
    },
    {
      title: 'Gladiator II',
      description: 'Years after witnessing the death of Maximus, Lucius is forced to enter the Colosseum after his home is conquered by tyrannical emperors who lead Rome with an iron fist, fighting to restore glory to the Empire.',
      duration: 148,
      releaseDate: new Date(2024, 10, 22),
      posterUrl: 'https://image.tmdb.org/t/p/w500/2cxhvwyEwRlysAmRH4iodkvo0z5.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/original/tOqIwliWMovSIZ9DyvHcHI7p2im.jpg',
      genres: ['Action', 'Drama'],
    },
    {
      title: 'Wicked',
      description: 'In the land of Oz, misunderstood green-skinned Elphaba forms an unlikely friendship with popular Glinda at Shiz University, tested as they fulfill their respective destinies as Glinda the Good and the Wicked Witch of the West.',
      duration: 161,
      releaseDate: new Date(2024, 10, 22),
      posterUrl: 'https://image.tmdb.org/t/p/w500/xDGbZ0JJ3mYaGKy4Nzd9Kph6M9L.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/original/fyZ6SDUS4o9jp2EHxfZa3qS9ean.jpg',
      genres: ['Fantasy', 'Drama', 'Romance'],
    },
    {
      title: 'The Wild Robot',
      description: 'After a shipwreck, an intelligent robot called Roz is stranded on an uninhabited island and bonds with the island animals, adopting an orphaned baby goose in a moving tale of survival and connection.',
      duration: 102,
      releaseDate: new Date(2024, 8, 27),
      posterUrl: 'https://image.tmdb.org/t/p/w500/wTnV3PCVW5O92JMrFvvrRcV39RU.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/original/1pmXyN3sKeYoUhu5VBZiDU4BX21.jpg',
      genres: ['Animation', 'Sci-Fi', 'Drama'],
    },
    {
      title: 'Captain America: Brave New World',
      description: 'Sam Wilson finds himself in the middle of an international incident after meeting with newly elected U.S. President Thaddeus Ross, uncovering a nefarious global plot before the mastermind behind it can plunge the world into chaos.',
      duration: 118,
      releaseDate: new Date(2025, 1, 14),
      posterUrl: 'https://image.tmdb.org/t/p/w500/pzIddUEMWhWzfvLI3TwxUG2wGoi.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/original/by8z9Fe8y7p4jo2YlW2SZDnptyT.jpg',
      genres: ['Action', 'Sci-Fi', 'Thriller'],
    },
    // Upcoming Releases (releaseDate in the future)
    {
      title: 'Superman',
      description: 'Superman, a journalist in Metropolis, embarks on a journey to reconcile his Kryptonian heritage with his human upbringing as Clark Kent in James Gunn new DC Universe vision.',
      duration: 135,
      releaseDate: new Date(now.getFullYear() + 1, 6, 11),
      posterUrl: 'https://image.tmdb.org/t/p/w500/ldyfo0BKmz5rWtJJKCvwaNS4cJT.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/original/yRBc6WY3r1Fz5Cjd6DhSvzqunED.jpg',
      genres: ['Action', 'Sci-Fi'],
    },
    {
      title: 'The Fantastic Four: First Steps',
      description: 'Set against the vibrant backdrop of a 1960s retro-futuristic world, Marvel First Family must balance their roles as superheroes and a tight-knit family while defending Earth against the cosmic entity Galactus.',
      duration: 130,
      releaseDate: new Date(now.getFullYear() + 1, 6, 25),
      posterUrl: 'https://image.tmdb.org/t/p/w500/veiSodk4JS4M2kBZCqBWeEEdMCr.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/original/pwCZP8QjiQRvz15MGxQckW0wl3a.jpg',
      genres: ['Action', 'Sci-Fi', 'Fantasy'],
    },
    {
      title: 'Avengers: Doomsday',
      description: 'Beloved heroes from distinct universes are set on a deadly collision course and face an existential threat unlike anything they have ever encountered as Doctor Doom rises to reshape reality.',
      duration: 165,
      releaseDate: new Date(now.getFullYear() + 1, 10, 1),
      posterUrl: 'https://image.tmdb.org/t/p/w500/jzPwsojjFStf5lR5Nm07w2hH56G.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/original/s4v0UX1anfXm0UvloLsTTJ4v222.jpg',
      genres: ['Action', 'Sci-Fi', 'Fantasy'],
    },
  ];

  for (const movieData of movies) {
    const { genres: genreList, ...data } = movieData;
    const movie = await prisma.movie.create({ data });

    // Create MovieGenre associations
    for (const genreName of genreList) {
      await prisma.movieGenre.create({
        data: {
          movieId: movie.id,
          genreId: genres[genreName],
        },
      });
    }
    console.log(`🎥 Created movie: ${movie.title} [${genreList.join(', ')}]`);
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

  console.log('\n✅ Seeding complete!');
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