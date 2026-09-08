# 🗄️ Phase 2: Step-by-Step Implementation Guide

**Goal:** Set up PostgreSQL (Neon), define the Prisma schema, run migrations, seed the database.

**Source of truth:** [CiniGo_Phase_Plan.md](CiniGo_Phase_Plan.md) lines 50–74 | [CiniGo_Scope.md](CiniGo_Scope.md) Section 6

---

## Step 1: Set Up Neon PostgreSQL

1. Go to **https://neon.tech** and sign up (GitHub login works).
2. Click **"Create Project"** → Name it `cinego`.
3. Select the **region closest to you** (e.g., Singapore for Thailand).
4. Once created, copy the **connection string** from the dashboard. It looks like:
   ```
   postgresql://username:password@ep-xxx-yyy-123456.ap-southeast-1.aws.neon.tech/cinego?sslmode=require
   ```
5. In your project root (`d:\RSU\SE\cinego`), create a file called **`.env`** (not `.env.local`):
   ```env
   # ── Database (Phase 2) ──────────────────────────────────────
   DATABASE_URL="postgresql://username:password@ep-xxx-yyy-123456.ap-southeast-1.aws.neon.tech/cinego?sslmode=require"

   # ── Authentication (Phase 3) ────────────────────────────────
   NEXTAUTH_SECRET=your-secret-here
   NEXTAUTH_URL=http://localhost:3000

   # ── Google Gemini API (Phase 5) ─────────────────────────────
   GOOGLE_GEMINI_API_KEY=your-gemini-api-key-here
   ```
6. Make sure `.env` is in your `.gitignore` (it should already be).

> **⚠️ CAUTION:** Never commit `.env` to Git. It contains your database credentials.

---

## Step 2: Git Branching ✅ ALREADY DONE

Branches have already been created for you:

```
develop
  └── phase/phase2-database          ← permanent milestone (NEVER deleted)
        └── feature/prisma-schema    ← you are HERE
```

You are currently on `feature/prisma-schema`. Start working from Step 3.

---

## Step 3: Install Prisma & Driver Adapter

```bash
npm install @prisma/client @prisma/adapter-pg pg
npm install -D prisma tsx @types/pg
```

Then initialize Prisma:

```bash
npx prisma init
```

This creates:
- `prisma/schema.prisma` (we'll update this in Step 4)
- `prisma.config.ts` (or create it in Step 5 if not automatically generated)
- `.env` (already created in Step 1 — if overwritten, re-paste your `DATABASE_URL`)

---

## Step 4: Write `prisma/schema.prisma`

Replace the entire contents of `prisma/schema.prisma` with the following. This is **verbatim from Scope Section 6** plus the required `datasource` and `generator` blocks:

```prisma
// prisma/schema.prisma
// CineGo — Database Schema (Phase 2)

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

// ── Enums ──────────────────────────────────────────────────

enum Role {
  CUSTOMER
  ADMIN
}

enum BookingStatus {
  PENDING
  PAID
  EXPIRED
  CANCELLED
}

enum PaymentStatus {
  SUCCESS
  FAILED
}

enum TicketStatus {
  ACTIVE
  USED
}

// ── Models ─────────────────────────────────────────────────

model User {
  id           String         @id @default(uuid())
  email        String         @unique
  passwordHash String
  role         Role           @default(CUSTOMER)
  createdAt    DateTime       @default(now())
  bookings     Booking[]
  interests    UserInterest[]
}

model Genre {
  id     String         @id @default(uuid())
  name   String         @unique
  movies MovieGenre[]
  users  UserInterest[]
}

model UserInterest {
  userId  String
  genreId String
  user    User   @relation(fields: [userId], references: [id])
  genre   Genre  @relation(fields: [genreId], references: [id])

  @@id([userId, genreId])
}

model Movie {
  id          String       @id @default(uuid())
  title       String
  description String
  duration    Int
  releaseDate DateTime
  posterUrl   String
  backdropUrl String
  genres      MovieGenre[]
  showtimes   Showtime[]
}

model MovieGenre {
  movieId String
  genreId String
  movie   Movie  @relation(fields: [movieId], references: [id])
  genre   Genre  @relation(fields: [genreId], references: [id])

  @@id([movieId, genreId])
}

model Cinema {
  id       String   @id @default(uuid())
  name     String
  location String
  screens  Screen[]
}

model Screen {
  id        String     @id @default(uuid())
  cinemaId  String
  name      String
  cinema    Cinema     @relation(fields: [cinemaId], references: [id])
  seats     Seat[]
  showtimes Showtime[]
}

model Seat {
  id        String        @id @default(uuid())
  screenId  String
  rowLabel  String
  seatNum   Int
  price     Decimal
  screen    Screen        @relation(fields: [screenId], references: [id])
  bookings  BookingSeat[]
}

model Showtime {
  id        String        @id @default(uuid())
  movieId   String
  screenId  String
  startsAt  DateTime
  endsAt    DateTime
  movie     Movie         @relation(fields: [movieId], references: [id])
  screen    Screen        @relation(fields: [screenId], references: [id])
  bookings  Booking[]
  seats     BookingSeat[]

  @@index([movieId, startsAt])
}

model Booking {
  id          String        @id @default(uuid())
  userId      String
  showtimeId  String
  status      BookingStatus @default(PENDING)
  totalAmount Decimal
  createdAt   DateTime      @default(now())
  user        User          @relation(fields: [userId], references: [id])
  showtime    Showtime      @relation(fields: [showtimeId], references: [id])
  seats       BookingSeat[]
  payment     Payment?
  ticket      Ticket?

  @@index([userId])
}

model BookingSeat {
  id              String   @id @default(uuid())
  bookingId       String
  showtimeId      String
  seatId          String
  priceAtPurchase Decimal
  heldUntil       DateTime?
  booking         Booking  @relation(fields: [bookingId], references: [id])
  showtime        Showtime @relation(fields: [showtimeId], references: [id])
  seat            Seat     @relation(fields: [seatId], references: [id])

  @@unique([showtimeId, seatId])
}

model Payment {
  id                   String        @id @default(uuid())
  bookingId            String        @unique
  status               PaymentStatus
  amount               Decimal
  transactionReference String        @unique
  paidAt               DateTime      @default(now())
  booking              Booking       @relation(fields: [bookingId], references: [id])
}

model Ticket {
  id         String       @id @default(uuid())
  bookingId  String       @unique
  ticketCode String       @unique
  qrPayload  String
  status     TicketStatus @default(ACTIVE)
  issuedAt   DateTime     @default(now())
  booking    Booking      @relation(fields: [bookingId], references: [id])
}
```

---

## Step 4.1: Create `prisma.config.ts` (Prisma 7 Standard)

In Prisma 7, the database connection URL for Prisma CLI and migrations is configured in `prisma.config.ts` in your project root (`d:\RSU\SE\cinego\prisma.config.ts`):

```typescript
// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

---

## Step 5: Update `src/lib/prisma.ts`

Replace the Phase 1 stub with the Prisma 7 client singleton using `@prisma/adapter-pg`:

```typescript
// src/lib/prisma.ts
// Prisma 7 Client singleton with PostgreSQL adapter — safe for Next.js hot-reload in development

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
```

---

## Step 6: Update `package.json`

Add the Prisma seed configuration. Add this block at the **top level** of your `package.json` (sibling to `"scripts"`, `"dependencies"`, etc.):

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

---

## Step 7: Validate Schema & Run Migration

```bash
# Validate your schema is correct
npx prisma validate

# Generate the Prisma client
npx prisma generate

# Run migration (creates all tables in Neon)
npx prisma migrate dev --name init
```

If successful, you'll see:
- A new `prisma/migrations/` folder with the SQL migration file
- The message: `Your database is now in sync with your schema.`

---

## Step 8: Merge `feature/prisma-schema` → `phase/phase2-database`

```bash
# Commit your work
git add .
git commit -m "feat(phase2): prisma schema with all 13 models, 4 enums, and initial migration"

# Switch to the phase branch and merge
git checkout phase/phase2-database
git merge feature/prisma-schema

# Delete the temporary feature branch
git branch -d feature/prisma-schema
```

---

## Step 9: Create `feature/seed-data` Branch

```bash
git checkout -b feature/seed-data
```

---

## Step 10: Write `prisma/seed.ts`

Create `prisma/seed.ts` with the following content. This seeds **exactly what the Phase Plan specifies**: cinema, screens, seat layouts (Rows A–F with row pricing), genres, and sample movies.

```typescript
// prisma/seed.ts
// CineGo — Database Seed Script (Phase 2)
// Idempotent: safe to re-run (deletes existing data first)

import { prisma } from '../src/lib/prisma';
import { Prisma } from '@prisma/client';

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
  //    Premium (A–B): ฿280
  //    Standard Plus (C–D): ฿200
  //    Standard (E–F): ฿150
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
```

---

## Step 11: Run Seed

```bash
npx prisma db seed
```

You should see output listing each created entity. If you need to re-run, it's safe — the script deletes all data first.

---

## Step 12: Verify (Verification Checkpoint)

```bash
npx prisma studio
```

This opens a web UI at `http://localhost:5555`. Check:

- [ ] **13 tables** visible (User, Genre, UserInterest, Movie, MovieGenre, Cinema, Screen, Seat, Showtime, Booking, BookingSeat, Payment, Ticket)
- [ ] **Cinema** table → 1 row ("CineGo Flagship")
- [ ] **Screen** table → 4 rows (IMAX Laser, Dolby Cinema, 4DX Motion, Standard)
- [ ] **Seat** table → 240 rows (60 per screen, Rows A–F, 10 seats/row)
- [ ] **Seat prices** → A/B rows = 280, C/D rows = 200, E/F rows = 150
- [ ] **Genre** table → 10 rows
- [ ] **Movie** table → 8 rows (5 now screening, 3 upcoming)
- [ ] **MovieGenre** table → genre associations for each movie
- [ ] **BookingSeat** table → confirm `@@unique([showtimeId, seatId])` constraint exists

To verify the unique index directly in PostgreSQL (optional):
```sql
-- Run in Neon SQL Editor or psql
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'BookingSeat';
```

---

## Step 13: Merge `feature/seed-data` → `phase/phase2-database`

```bash
git add .
git commit -m "feat(phase2): idempotent seed script with cinema, screens, seats, genres, and movies"

git checkout phase/phase2-database
git merge feature/seed-data

# Delete the temporary feature branch
git branch -d feature/seed-data
```

---

## Step 14: Final Merge `phase/phase2-database` → `develop`

```bash
git checkout develop
git merge phase/phase2-database

# Push everything (keep phase branch on GitHub)
git push origin develop
git push origin phase/phase2-database
```

> **⚠️ IMPORTANT:** Do **NOT** delete `phase/phase2-database`. It stays on GitHub permanently as a milestone record.

---

## ✅ Phase 2 Complete — Summary

| What | Status |
|:---|:---|
| Neon PostgreSQL database | ✅ Running |
| `prisma/schema.prisma` — 13 models, 4 enums | ✅ Written |
| `@@unique([showtimeId, seatId])` constraint | ✅ Enforced |
| `prisma migrate dev --name init` | ✅ Executed |
| `src/lib/prisma.ts` — singleton client | ✅ Updated |
| `prisma/seed.ts` — idempotent seed | ✅ Written & run |
| Seed: 1 cinema, 4 screens, 240 seats, 10 genres, 8 movies | ✅ Verified in Prisma Studio |
| `feature/prisma-schema` → `phase/phase2-database` | ✅ Merged & deleted |
| `feature/seed-data` → `phase/phase2-database` | ✅ Merged & deleted |
| `phase/phase2-database` → `develop` | ✅ Merged & preserved |

**Next up:** Phase 3 — Authentication & Role-Based Security 🔐
