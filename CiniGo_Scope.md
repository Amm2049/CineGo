# CINEMA TICKET BOOKING SYSTEM (CineGo)
## Full Software Engineering Project Scope & MVP Specification (Version 1.6)

| Metadata Field | Value |
| :--- | :--- |
| **PROJECT TITLE** | CineGo — Cinema Ticket Booking System |
| **PROJECT TYPE** | Full-Stack Software Engineering Web Application |
| **PROJECT MODEL** | Solo Project / Small Team MVP |
| **ARCHITECTURE** | Layered Monolithic Architecture (Clean Code & SE Best Practices) |
| **PRIMARY ROLES** | Customer + Admin |
| **DOCUMENT VERSION** | 1.6 (Stripe PromptPay payments in test mode with a simulated fallback — upgraded from v1.5) |

---

## 1. Executive Summary
The **Cinema Ticket Booking System (CineGo)** is a full-stack web application built with **Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, PostgreSQL, Prisma ORM, Auth.js, Google Gemini LLM API, and TMDB REST API**. 

The platform enables customers to discover movies (ingested from TMDB via automated weekly Vercel Cron Job and Admin curation), view in-line AI match recommendations (`🔥 95% AI Match`), explore cinema screen formats on an Experiences FYI page, select seats on an interactive layout with dynamic row pricing, temporarily hold seats during checkout, pay by scanning a **PromptPay QR code (Stripe, test mode)** — or use the simulated payment fallback — and receive a digital ticket pass with **one scannable QR code per seat**. Movie availability status ("Now Showing" vs. "Upcoming") is computed dynamically from `releaseDate` and active showtime existence — never stored as a manual flag. Administrators can trigger a 1-Click bulk sync, import specific movies directly from TMDB, manage showtimes, and verify customer tickets using an integrated **Camera WebCam QR Scanner**.

---

## 2. Core Architectural & Engineering Principles

### 📁 2.1 Clean Directory Architecture & SE Best Practices
The codebase strictly adheres to **Software Engineering (SE) best practices**, maintaining modularity, strong separation of concerns, and clean file/folder organization:

```
src/
├── app/                        # Next.js App Router (Pages & API Route Handlers)
│   ├── (auth)/                 # Login & Register pages
│   ├── (customer)/             # Customer browsing, movies, experiences, seat map, tickets
│   ├── admin/                  # Admin dashboard & ticket scanner
│   └── api/                    # RESTful serverless API endpoints & Server Actions
│       ├── cron/               # Automated Vercel Cron jobs (weekly movie sync)
│       └── ...
├── components/                 # Reusable React UI Components
│   ├── ui/                     # shadcn/ui primitive components (Button, Dialog, Card)
│   ├── layout/                 # Navbar, Footer, Sidebar
│   ├── movies/                 # Movie cards & in-line AI match badges
│   ├── seatmap/                # Interactive seat grid & row pricing
│   └── admin/                  # WebCam QR Ticket Scanner component
├── lib/                        # Infrastructure & Utilities
│   ├── prisma.ts               # Prisma client singleton
│   ├── auth.ts                 # Auth.js / NextAuth configuration
│   ├── gemini.ts               # Google Gemini LLM API client wrapper
│   └── tmdb.ts                 # TMDB REST API client wrapper (movie import)
├── services/                   # Business Logic & Domain Services (Separation of Concerns)
│   ├── movie-sync.service.ts   # TMDB fetch & upsert logic (shared by Cron & Admin Sync)
│   ├── recommendation.service.ts
│   ├── booking.service.ts
│   ├── seat.service.ts         # Seat hold (heldUntil) & availability logic
│   └── ticket.service.ts
└── types/                      # TypeScript interfaces & type definitions
```

### 🌿 2.2 Git & Branching Strategy (`Phase-Based GitFlow`)
The repository uses a disciplined 4-tier branching model tailored for milestone phase deliverables:

1. **`main` Branch (Production):**
   * Contains stable, production-ready deployable releases.
2. **`develop` Branch (Integration Trunk):**
   * Primary integration branch where completed phases are merged and tested.
3. **`phase/*` Branches (Milestone Phase Branches - PERMANENT):**
   * Naming convention: `phase/phase1-setup`, `phase/phase2-database`, `phase/phase3-auth`, etc.
   * Branched directly off `develop`.
   * **These branches are NEVER deleted**—they remain in GitHub history to record milestone progress and academic review.
4. **`feature/*` Branches (Feature / Task Level - TEMPORARY):**
   * Naming convention: `feature/schema-models`, `feature/prisma-seed`, `feature/login-ui`, etc.
   * Branched off their respective active `phase/*` branch.
   * Once a feature is developed and tested, it is merged back into its parent `phase/*` branch, and the temporary `feature/*` branch is deleted.
   * Once all features for that phase are complete and verified, the `phase/*` branch is merged into `develop`.

---

## 3. Technology Stack & Architectural Choices

| Layer | Technology | Engineering Role & Strategy |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router) + TypeScript | Full-stack React framework with Server Components & Server Actions. |
| **UI & Styling** | Tailwind CSS + shadcn/ui | **Dark Mode Cinema Aesthetic** by default (Dark background, neon/accent highlights). |
| **Data Fetching** | Server Components + **SWR** | **Server Components** for main page loads; **SWR (`useSWR` with 5s polling)** for background seat map auto-refresh. |
| **Database & ORM** | PostgreSQL + Prisma ORM | Relational integrity, migrations, and atomic `$transaction` queries. |
| **AI Recommendation** | Google Gemini LLM API (`@google/genai`) | Structured JSON generation for movie match scores (%), rendered as **In-Line Badges**, plus a 1-sentence explanation returned by the API (not shown on cards). |
| **Authentication** | Auth.js (NextAuth) + bcrypt | Hashed credentials & role-based route protection (`CUSTOMER`, `ADMIN`). |
| **QR Code System** | `qrcode.react` + `html5-qrcode` | `qrcode.react` renders ticket QR codes; `html5-qrcode` powers the WebCam Scanner. |
| **Payments** | Stripe (`stripe` Node SDK) — PromptPay, **test mode only** | Server-side PaymentIntent with PromptPay QR (`next_action.promptpay_display_qr_code`); Stripe webhook (`/api/webhooks/stripe`, signature-verified) is the source of truth for success; automatic refunds when seats were lost. `PAYMENT_PROVIDER=simulated` keeps the offline simulated payment for CI and demos. |
| **Movie Data & Ingestion** | TMDB REST API + Vercel Cron | Hybrid ingestion architecture: Automated weekly synchronization via **Vercel Cron Job** (`/api/cron/sync-movies` secured with `CRON_SECRET`) + Admin 1-Click "⚡ Sync Latest Releases" bulk trigger + Admin manual search & import (`POST /api/admin/movies/sync`). Standard catalog target: **20 Now Showing** and **40 Upcoming** English-language releases *(Phase 10: was 10/20 from all languages; upcoming now comes from TMDB Discover — Thai cinema release within ~6 months — and re-releases are skipped)*. Safe idempotent upsert via `tmdbId`. `prisma/seed.ts` supports live TMDB sync with a 14-day rolling window. `next.config.ts` whitelists `image.tmdb.org`. |
| **Media Handling** | External Image URLs | Movie poster (portrait) & hero/backdrop (landscape) images linked via TMDB CDN URLs (`image.tmdb.org`). |
| **Testing & CI/CD** | Vitest + Playwright + GitHub Actions | Unit, integration, E2E, and concurrency testing with automated CI on Vercel. |

---

## 4. Final 13-Page Inventory & Feature Scope

### 🌐 4.1 Customer Pages (8 Pages)
1. **Homepage (`/`):** Hero Banner (the 5 most anticipated upcoming releases by TMDB popularity, *changed in Phase 10*; falls back to Now Showing when nothing is upcoming) + 5-card Now Showing preview + 5-card Upcoming Releases preview (both with in-line `🔥 {matchScore}%` AI recommendation badges and fully clickable cards without inner button clutter) + *"View All Movies →"* and *"Explore All Upcoming →"* CTAs. Movie lists are fetched live from the database — **"Now Showing"** = `releaseDate ≤ today AND has at least one future showtime`; **"Upcoming"** = `releaseDate > today`. No status flags stored.
2. **Movies Catalog Page (`/movies`):** Clean 2-tab view (`[ 🍿 Now Showing ]` vs `[ 📅 Upcoming Releases ]`) displaying movies queried dynamically from the database with derived status logic and AI match badges.
2a. **Movie & Showtime Picker (`/movies/[id]`):** *(added in Phase 10)* Movie details plus a date strip (Today, Tomorrow, …) and the day's times grouped by theatre/format, with seats left (sold + held) and sold-out times disabled; each time opens `/checkout/[showtimeId]`. Movie cards and the hero link here; the seat map links back via "Change showtime". Hidden (inactive) movies show Not Found.
3. **Experiences FYI Page (`/experiences`):** Informational page highlighting cinema screen formats (IMAX Laser, Dolby Cinema, 4DX Motion, VIP Lounge).
4. **Seat Selection & Checkout (`/checkout/[showtimeId]`):** Interactive seat map, dynamic row pricing, 5-minute seat hold timer (`heldUntil`), SWR polling, and payment: a Stripe PromptPay QR with a 10-minute payment countdown and automatic redirect to the ticket once paid (or the simulated payment when `PAYMENT_PROVIDER` is not `stripe`).
5. **Digital Ticket Pass (`/tickets/[bookingId]`):** One pass per booking holding **one ticket per seat**, each with its own scannable QR code (`qrcode.react`) and manual entry code, plus screen number, showtime and booking reference. Each person in a group shows their own seat's QR.
6. **My Tickets & History (`/tickets`):** One row per booking (with how many of its seats are used), upcoming and past.
7. **Profile & Genre Preferences (`/profile`):** Manage account details & select/update favorite genres for AI recommendations.

### 🔐 4.2 Authentication Pages (2 Pages)
8. **Login Page (`/login`):** Account sign-in form with Auth.js credentials.
9. **Register Page (`/register`):** Account sign-up form with bcrypt password hashing.

### 🛠️ 4.3 Admin Pages (4 Pages)
10. **Admin Dashboard (`/admin`):** Operational overview metrics (total movies, showtimes, revenue).
11. **Manage Movies (`/admin/movies`):** Features a 1-Click **"⚡ Sync Latest Releases"** button to trigger instant catalog synchronization with TMDB, alongside search-by-title import (`POST /api/admin/movies/sync`) — admin selects a result and clicks Import to upsert movie data (title, description, runtime, release date, poster, backdrop, genres). Existing imported movies can be edited or deactivated.
12. **Manage Showtimes (`/admin/showtimes`):** Create showtime schedules per screen with overlap validation.
13. **WebCam QR Ticket Scanner (`/admin/scanner`):** Live camera WebCam QR scanner (`html5-qrcode`) + manual ticket code input fallback to verify entry (`VALID`, `INVALID`, `ALREADY USED`). **One scan admits one seat**; the result shows the seat and how many of the booking's seats are already in.

---

## 5. Functional Requirements (FR)

* **FR-01 (Auth):** Passwords stored as bcrypt hashes; roles enforced server-side.
* **FR-02 (In-Line AI Recommendations):** `/api/recommendations` invokes Gemini API with user interests & booking history, returning structured JSON (`movieId`, `matchScore`, `reason`) rendered as glowing **In-Line AI Match Badges** on movie cards.
* **FR-03 (Movie & Showtime Browsing):** Customers browse movies on `/` and `/movies`. Movie availability status is **derived at query time** — never stored as a field. "Now Showing" = `releaseDate ≤ today AND showtimes.some(startsAt ≥ today)`. "Upcoming" = `releaseDate > today`.
* **FR-04 (Experiences FYI):** Informational page (`/experiences`) explaining screen technologies (IMAX, Dolby, 4DX, VIP).
* **FR-05 (Seat Selection & Dynamic Pricing):** Interactive seat map calculates price totals based on row pricing rules.
* **FR-06 (Concurrency & Holds):** Seats held for 5 minutes via `heldUntil` (set to `NOW + 5min` on seat selection, cleared on expiry or payment). Starting a PromptPay payment extends the hold **once** to the 10-minute payment window plus a 2-minute grace period (see FR-10); seats are locked while the payment is open. Database transaction guarantees atomic confirmation. `@@unique([showtimeId, seatId])` prevents double-booking.
* **FR-07 (Digital Ticket & QR):** A paid booking generates **one digital ticket per seat**, each with its own unique code and rendered QR code.
* **FR-08 (Admin Scanner & CRUD):** Admin WebCam QR Scanner reads QR tokens or manual ticket codes and displays ticket validation results. Each scan admits exactly one seat; a seat can be admitted only once. Admin manages Showtimes via form-based CRUD.
* **FR-09 (TMDB Movie Ingestion & Automated Cron Sync):** Hybrid ingestion model. (1) **Automated Vercel Cron Job:** Runs weekly via `GET /api/cron/sync-movies` (secured with `CRON_SECRET` authorization header) to keep the catalog fresh with up to 20 Now Showing and 40 Upcoming English-language releases (Phase 10). (2) **Admin On-Demand Curation:** Admin can trigger an immediate 1-click catalog sync or search and import specific TMDB titles via `POST /api/admin/movies/sync`. The system fetches movie metadata (title, overview, runtime, release date, poster, backdrop, genres) and idempotently upserts `Movie` records using `tmdbId` as the unique key to prevent duplicates. Availability status remains derived dynamically from `releaseDate` and future showtimes. In development, `prisma/seed.ts` syncs live TMDB data with 10 Now Playing + 20 Upcoming movies and schedules a 14-day conflict-free rolling showtime window.
* **FR-10 (Stripe PromptPay Payment):** With `PAYMENT_PROVIDER=stripe`, "Pay" re-prices the held seats server-side and creates a Stripe PaymentIntent (THB, PromptPay, test-mode keys only). The customer has **10 minutes** to scan the QR; seats stay held for **10 + 2 minutes** (grace for late webhooks). When the window ends the server cancels the PaymentIntent so the QR can no longer be paid (triggered by the customer's countdown, the status poll, or another customer trying to hold those seats — no cron). Only a `payment_intent.succeeded` event (webhook, or the status poll as a fallback) can mark a booking `PAID`: it is confirmed if the booking still owns every seat it paid for, otherwise the payment is **refunded automatically**. Duplicate webhooks are ignored (idempotent settle, `transactionReference` = PaymentIntent id). The simulated payment remains available as a fallback.

---

## 6. Database Schema Design (Prisma Entities)

> **Prisma 7 Compliance**: Under Prisma 7, connection URLs for migrations are configured in `prisma.config.ts` (`datasource.url = env("DATABASE_URL")`), while `schema.prisma` declares `datasource db { provider = "postgresql" }` without inline `url`. Runtime queries connect via `@prisma/adapter-pg`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

model User {
  id           String         @id @default(uuid())
  email        String         @unique
  passwordHash String
  role         Role           @default(CUSTOMER)
  createdAt    DateTime       @default(now())
  bookings     Booking[]
  interests    UserInterest[]
}

enum Role {
  CUSTOMER
  ADMIN
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
  tmdbId      Int?         @unique
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
  tickets     Ticket[] // one per seat

  @@index([userId])
}

enum BookingStatus {
  PENDING
  PAID
  EXPIRED
  CANCELLED
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
  ticket          Ticket?

  @@unique([showtimeId, seatId])
}

model Payment {
  id                   String          @id @default(uuid())
  bookingId            String          @unique
  provider             PaymentProvider @default(SIMULATED)
  status               PaymentStatus
  amount               Decimal
  transactionReference String          @unique // SIM-<uuid> or Stripe PaymentIntent id
  createdAt            DateTime        @default(now())
  expiresAt            DateTime?       // end of the 10-minute PromptPay window
  paidAt               DateTime?       // set only on SUCCESS
  refundedAt           DateTime?
  booking              Booking         @relation(fields: [bookingId], references: [id])

  @@index([status, expiresAt])
}

enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
  CANCELLED
  REFUNDED
}

enum PaymentProvider {
  SIMULATED
  STRIPE
}

// One ticket (QR) per booked seat
model Ticket {
  id            String       @id @default(uuid())
  bookingId     String
  bookingSeatId String       @unique
  ticketCode    String       @unique
  qrPayload     String
  status        TicketStatus @default(ACTIVE)
  issuedAt      DateTime     @default(now())
  booking       Booking      @relation(fields: [bookingId], references: [id])
  bookingSeat   BookingSeat  @relation(fields: [bookingSeatId], references: [id])
}

enum TicketStatus {
  ACTIVE
  USED
}
```

---

## 7. Definition of Done & Deliverables

1. **Deployed Application:** Deployed Next.js full-stack web application on Vercel.
2. **Database & ORM:** PostgreSQL database hosted on Supabase/Neon with Prisma migrations & seed data.
3. **Clean Code & GitFlow:** Modular directory structure following SE best practices with disciplined 4-tier `main` $\rightarrow$ `develop` $\rightarrow$ `phase/*` (permanent) $\rightarrow$ `feature/*` (temporary) Git branching.
4. **TMDB Movie Ingestion & Automated Cron Sync:** Automated weekly Vercel Cron Job (`/api/cron/sync-movies`), Admin 1-Click bulk sync button, and manual TMDB search-and-import flow with target catalog of up to 20 Now Showing and 40 Upcoming English-language movies (Phase 10); `Movie.tmdbId` prevents duplicates via idempotent upsert.
5. **Derived Movie Status:** "Now Showing" and "Upcoming" sections on homepage and catalog page driven by live Prisma queries — no stored status flags.
6. **AI Recommendation Badges:** Gemini LLM API integration rendering in-line AI match badges (1-sentence insights generated but not displayed on cards).
7. **Seat Concurrency Protection:** PostgreSQL `heldUntil` seat hold (5-minute TTL) + transaction and unique constraint protection against double-booking.
8. **Digital QR Ticket & WebCam Scanner:** Working digital tickets (one QR per seat) and an Admin Camera WebCam ticket scanner that admits one seat per scan.
9. **Testing Suite:** Automated unit/integration tests with Vitest and E2E concurrency tests with Playwright.
10. **Stripe PromptPay Payment (test mode):** PromptPay QR checkout with a 10-minute payment window, signature-verified Stripe webhook, automatic refund when seats were lost, and the simulated payment kept as a fallback.
