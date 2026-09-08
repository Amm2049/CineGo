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
  //    Front  (A–B): ฿150
  //    Middle (C–D): ฿200
  //    Back   (E–F): ฿280  (premium)
  const rowPricing: Record<string, number> = {
    A: 150,
    B: 150,
    C: 200,
    D: 200,
    E: 280,
    F: 280,
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
    // Now Screening (releaseDate in the past)
    {
      title: 'Neon Horizon',
      description: 'A rogue pilot discovers a hidden dimension beyond the neon-lit skyline of Neo-Tokyo, where reality bends and time fractures.',
      duration: 138,
      releaseDate: new Date(now.getFullYear(), now.getMonth() - 2, 10),
      posterUrl: 'https://placehold.co/400x600/1a1a2e/e94560?text=Neon+Horizon',
      backdropUrl: 'https://placehold.co/1280x720/1a1a2e/e94560?text=Neon+Horizon+Hero',
      genres: ['Action', 'Sci-Fi'],
    },
    {
      title: 'The Last Encore',
      description: 'An aging jazz musician gets one final chance to perform at the legendary Blue Moon Theatre, confronting old rivals and lost love.',
      duration: 112,
      releaseDate: new Date(now.getFullYear(), now.getMonth() - 1, 5),
      posterUrl: 'https://placehold.co/400x600/16213e/0f3460?text=The+Last+Encore',
      backdropUrl: 'https://placehold.co/1280x720/16213e/0f3460?text=The+Last+Encore+Hero',
      genres: ['Drama', 'Romance'],
    },
    {
      title: 'Phantom Protocol',
      description: 'When a covert intelligence network is compromised, a disgraced agent must go off-grid to expose a conspiracy that reaches the highest levels of government.',
      duration: 126,
      releaseDate: new Date(now.getFullYear(), now.getMonth() - 1, 20),
      posterUrl: 'https://placehold.co/400x600/0a1628/e23e57?text=Phantom+Protocol',
      backdropUrl: 'https://placehold.co/1280x720/0a1628/e23e57?text=Phantom+Protocol+Hero',
      genres: ['Thriller', 'Action'],
    },
    {
      title: 'Laughing Shadows',
      description: 'A stand-up comedian accidentally witnesses a crime and must survive the night while keeping the audience laughing.',
      duration: 98,
      releaseDate: new Date(now.getFullYear(), now.getMonth(), 1),
      posterUrl: 'https://placehold.co/400x600/2d3436/fdcb6e?text=Laughing+Shadows',
      backdropUrl: 'https://placehold.co/1280x720/2d3436/fdcb6e?text=Laughing+Shadows+Hero',
      genres: ['Comedy', 'Thriller'],
    },
    {
      title: 'Whispers in the Hollow',
      description: 'A family moves into a centuries-old farmhouse only to discover the walls hold memories — and something that remembers them back.',
      duration: 104,
      releaseDate: new Date(now.getFullYear(), now.getMonth(), 5),
      posterUrl: 'https://placehold.co/400x600/1b1b2f/e43f5a?text=Whispers+in+the+Hollow',
      backdropUrl: 'https://placehold.co/1280x720/1b1b2f/e43f5a?text=Whispers+in+the+Hollow+Hero',
      genres: ['Horror'],
    },
    // Upcoming Releases (releaseDate in the future)
    {
      title: 'Starforged',
      description: 'In a galaxy where stars are forged into weapons, a young blacksmith holds the key to ending an interstellar war.',
      duration: 145,
      releaseDate: new Date(now.getFullYear(), now.getMonth() + 2, 15),
      posterUrl: 'https://placehold.co/400x600/0c0c1d/7f5af0?text=Starforged',
      backdropUrl: 'https://placehold.co/1280x720/0c0c1d/7f5af0?text=Starforged+Hero',
      genres: ['Sci-Fi', 'Fantasy', 'Action'],
    },
    {
      title: 'The Panda Express',
      description: 'A clumsy panda delivery driver accidentally picks up a mysterious package that sends him on a wild cross-country adventure.',
      duration: 95,
      releaseDate: new Date(now.getFullYear(), now.getMonth() + 3, 1),
      posterUrl: 'https://placehold.co/400x600/2d3436/00b894?text=The+Panda+Express',
      backdropUrl: 'https://placehold.co/1280x720/2d3436/00b894?text=The+Panda+Express+Hero',
      genres: ['Animation', 'Comedy'],
    },
    {
      title: 'Beyond the Ice Wall',
      description: 'A documentary crew ventures to the unexplored edges of Antarctica and captures footage that challenges everything we know about Earth\'s history.',
      duration: 110,
      releaseDate: new Date(now.getFullYear(), now.getMonth() + 4, 10),
      posterUrl: 'https://placehold.co/400x600/206a5d/bef992?text=Beyond+the+Ice+Wall',
      backdropUrl: 'https://placehold.co/1280x720/206a5d/bef992?text=Beyond+the+Ice+Wall+Hero',
      genres: ['Documentary'],
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
- [ ] **Seat prices** → A/B rows = 150, C/D rows = 200, E/F rows = 280
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
