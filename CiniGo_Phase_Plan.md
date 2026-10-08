# CINEMA TICKET BOOKING SYSTEM (CineGo)
## Phase-by-Phase Modular Development Roadmap (`CiniGo_Phase_Plan.md` v1.4)

This roadmap divides the project into **8 manageable, self-contained phases** using a disciplined 4-tier **Phase-Based GitFlow branching model (`main` $\rightarrow$ `develop` $\rightarrow$ `phase/*` $\rightarrow$ `feature/*`)**. Each phase contains explicit deliverables, task checklists, Git branching instructions, and verification steps.

---

## 📌 GitFlow Development Workflow Rules

1. **4-Tier Branching Strategy:**
   * `main`: Production-ready, deployable releases.
   * `develop`: Active integration & staging trunk.
   * `phase/phaseX-...`: **Permanent Phase Milestone branches** branched off `develop`. (Never deleted).
   * `feature/*`: **Temporary Feature branches** branched off their respective `phase/*` branch. (Deleted once merged back into `phase/*`).
2. **Phase Lifecycle Workflow:**
   * Branch `phase/phaseX-...` off `develop`.
   * For each distinct task/feature, branch `feature/task-name` off `phase/phaseX-...`.
   * Develop, test, and merge `feature/task-name` into `phase/phaseX-...`.
   * Delete the completed `feature/task-name` branch.
   * When the entire phase is complete and verified, merge `phase/phaseX-...` back into `develop`.
   * **Keep `phase/phaseX-...` branch preserved on GitHub** for submission and review history.

---

## 🚀 Phase 1: Project Setup, Clean Architecture & Git Setup (Completed)

### 🎯 Objective
Initialize Git repository with `main` & `develop` branches, configure Next.js App Router with TypeScript, Tailwind CSS, `shadcn/ui` (Dark Mode Cinema theme), and set up the modular directory structure.

### 📋 Checklist & Tasks
* [x] Initialize Git repo, create `develop` branch off `main`.
* [x] Create permanent milestone branch `phase/phase1-setup` off `develop`.
* [x] Initialize Next.js 14+ (App Router) project with TypeScript.
* [x] Install & configure Tailwind CSS + `shadcn/ui` (Dark Mode Cinema theme by default).
* [x] Set up clean directory structure:
  * `src/app/` (Pages & API route handlers)
  * `src/components/` (`ui`, `layout`, `movies`, `seatmap`, `admin`)
  * `src/lib/` (Prisma client, Auth config, Gemini client, utils)
  * `src/services/` (Domain services for business logic)
  * `src/types/` (TypeScript definitions)
* [x] Configure ESLint, Prettier, `.env.example`, and initial `README.md`.
* [x] Merge `phase/phase1-setup` into `develop` (retaining `phase/phase1-setup` on GitHub).

### ✅ Verification Checkpoint
* Run `npm run dev` and verify clean loading of homepage with dark cinema theme.
* Confirm zero TypeScript or linting errors (`npm run lint`).

---

## 🗄️ Phase 2: Database Schema, Prisma ORM & Seed Data (Completed)

### 🎯 Objective
Create permanent milestone branch `phase/phase2-database` off `develop`. Define PostgreSQL schema in Prisma ORM, run migrations, enforce unique seat reservation constraints, and seed cinema, screen, seat layout, genre, and movie data using temporary task branches (`feature/*`).

### 📋 Checklist & Tasks
* [x] Create milestone branch `phase/phase2-database` off `develop`.
* [x] Branch `feature/prisma-schema` off `phase/phase2-database`:
  * Install Prisma ORM (`@prisma/client`, `prisma`).
  * Write `prisma/schema.prisma` with core entities:
    * `User`, `Role`, `Genre`, `UserInterest`
    * `Cinema`, `Screen`, `Seat`
    * `Movie` (include `tmdbId Int? @unique` for TMDB import deduplication), `MovieGenre`, `Showtime`
    * `Booking`, `BookingSeat` (include `heldUntil DateTime?`), `Payment`, `Ticket`
  * Enforce PostgreSQL unique constraint on `BookingSeat`: `@@unique([showtimeId, seatId])`.
  * Execute initial migration: `npx prisma migrate dev --name init`.
  * Merge `feature/prisma-schema` into `phase/phase2-database` and delete feature branch.
* [x] Branch `feature/seed-data` off `phase/phase2-database`:
  * Write `prisma/seed.ts` script to populate screens, seat layouts (Rows A–F with row pricing), genres, and sample movies (supporting live TMDB API sync with standard catalog target of 10 Now Showing + 20 Upcoming movies, resilient offline fallback, and a 14-day rolling conflict-free showtime schedule).
  * Run seed script (`npx prisma db seed`).
  * Merge `feature/seed-data` into `phase/phase2-database` and delete feature branch.
* [x] Merge `phase/phase2-database` into `develop` and preserve `phase/phase2-database` on GitHub.

### ✅ Verification Checkpoint
* Inspect database via `npx prisma studio`. Confirm `BookingSeat` unique index exists and `Movie.tmdbId` column is present in PostgreSQL.

---

## 🔐 Phase 3: Authentication & Role-Based Security (Completed)

### 🎯 Objective
Create permanent milestone branch `phase/phase3-auth` off `develop`. Implement Auth.js (NextAuth) with password hashing (bcrypt), session management, role protection middleware (`CUSTOMER` vs `ADMIN`), and Auth UI pages using temporary task branches (`feature/*`).

### 📋 Checklist & Tasks
* [x] Create milestone branch `phase/phase3-auth` off `develop`.
* [x] Branch `feature/auth-config` off `phase/phase3-auth`:
  * Install Auth.js (`next-auth`) and `bcryptjs`.
  * Configure Auth.js credentials provider in `src/lib/auth.ts`.
  * Build `/api/auth/register` API endpoint with bcrypt hashing.
  * Merge `feature/auth-config` into `phase/phase3-auth` and delete feature branch.
* [x] Branch `feature/auth-ui` off `phase/phase3-auth`:
  * Build Login (`/login`) and Register (`/register`) UI pages.
  * Add Next.js middleware for role-based route protection (`/admin/*` restricted to Admin role).
  * Create Navigation Bar header (`Navbar.tsx`) displaying links based on Auth state.
  * Merge `feature/auth-ui` into `phase/phase3-auth` and delete feature branch.
* [x] Merge `phase/phase3-auth` into `develop` and preserve `phase/phase3-auth` on GitHub.

### ✅ Verification Checkpoint
* Register a new Customer account and log in. Verify `/admin` access is denied for Customer role and allowed for Admin role.

---

## 🎬 Phase 4: Movies Catalog, Experiences Page & Profile Settings (Completed)

### 🎯 Objective
Create permanent milestone branch `phase/phase4-movies` off `develop`. Build the Homepage (`/`), Movies Catalog page (`/movies`), Experiences FYI page (`/experiences`), and Profile Settings page (`/profile`) using temporary task branches (`feature/*`).

### 📋 Checklist & Tasks
* [x] Create milestone branch `phase/phase4-movies` off `develop`.
* [x] Branch `feature/homepage-catalog` off `phase/phase4-movies`:
  * Build Homepage (`/`) as a **Server Component**:
    * Hero Banner (featured blockbuster — first "Now Showing" movie from DB).
    * 5-card **Now Showing** preview: Prisma query `WHERE releaseDate ≤ today AND showtimes.some(startsAt ≥ today)`, with in-line `🔥 AI Match` badges, fully clickable cards + *"View All Movies →"* CTA.
    * 5-card **Upcoming Releases** preview: Prisma query `WHERE releaseDate > today`, with in-line `🔥 AI Match` badges, fully clickable cards + *"Explore All Upcoming →"* CTA.
    * Extract interactive parts (e.g., hero carousel state) into a dedicated Client Component; keep data-fetching in the Server Component.
  * Build Movies Catalog Page (`/movies`):
    * Clean 2-tab layout: `[ 🍿 Now Showing ]` vs `[ 📅 Upcoming Releases ]` — both tabs fetch from DB using the same derived status queries. No static/hardcoded data.
  * Merge `feature/homepage-catalog` into `phase/phase4-movies` and delete feature branch.
* [x] Branch `feature/experiences-profile` off `phase/phase4-movies`:
  * Build Experiences Page (`/experiences`): FYI showcase for IMAX Laser, Dolby Cinema, 4DX Motion, and VIP Lounge.
  * Build Profile Settings Page (`/profile`): Multi-select genre preferences & API endpoint `POST /api/user/interests`.
  * Merge `feature/experiences-profile` into `phase/phase4-movies` and delete feature branch.
* [x] Merge `phase/phase4-movies` into `develop` and preserve `phase/phase4-movies` on GitHub.

### ✅ Verification Checkpoint
* Verify navigation across Home, Movies (2-tab catalog), Experiences, and Profile pages.
* Confirm "Now Showing" and "Upcoming" tabs reflect actual DB data — add/remove a showtime and confirm the movie moves between tabs without any code change.
* Confirm favorite genre selections persist in database.

---

## 🤖 Phase 5: AI Movie Recommendation Engine (Gemini LLM API) (Completed)

### 🎯 Objective
Create permanent milestone branch `phase/phase5-recommendations` off `develop`. Integrate Google Gemini LLM API to generate structured JSON recommendations and render **In-Line AI Match Badges** on movie cards using temporary task branches (`feature/*`).

### 📋 Checklist & Tasks
* [x] Create milestone branch `phase/phase5-recommendations` off `develop`.
* [x] Branch `feature/gemini-service` off `phase/phase5-recommendations`:
  * Install `@google/genai` SDK and configure `src/lib/gemini.ts`.
  * Create `src/services/recommendation.service.ts`:
    * Read user interests from `UserInterest` & past bookings from `Booking`.
    * Send structured prompt to Gemini API requesting JSON output (`movieId`, `matchScore`, `reason`).
  * Build `/api/recommendations` GET Route Handler.
  * Merge `feature/gemini-service` into `phase/phase5-recommendations` and delete feature branch.
* [x] Branch `feature/recommendation-ui` off `phase/phase5-recommendations`:
  * Update Movie Cards to display **In-Line AI Match Badges** (`🔥 {matchScore}%`) and 1-sentence AI insights.
  * Merge `feature/recommendation-ui` into `phase/phase5-recommendations` and delete feature branch.
* [x] Merge `phase/phase5-recommendations` into `develop` and preserve `phase/phase5-recommendations` on GitHub.

### ✅ Verification Checkpoint
* Test `/api/recommendations` API response. Verify glowing `🔥 AI Match` badges render on movie cards for logged-in users.

---

## 💺 Phase 6: Interactive Seat Map, Dynamic Pricing & SWR Polling

### 🎯 Objective
Create permanent milestone branch `phase/phase6-seatmap` off `develop`. Implement the interactive seat selection layout, row-based pricing calculations, 5-minute temporary seat hold, and SWR background polling for live availability using temporary task branches (`feature/*`).

### 📋 Checklist & Tasks
* [x] Create milestone branch `phase/phase6-seatmap` off `develop`.
* [x] Branch `feature/seatmap-api` off `phase/phase6-seatmap`:
  * Build `GET /api/showtimes/[id]/seats` endpoint: returns full seat grid with status per seat:
    * `BOOKED` — `BookingSeat` record exists with a `PAID` booking.
    * `HELD` — `BookingSeat` record exists with `heldUntil > NOW` (active hold by another user).
    * `AVAILABLE` — no matching record, or `heldUntil` is expired/null.
  * Implement seat hold in `src/services/seat.service.ts`:
    * `holdSeat(showtimeId, seatId, bookingId)` — upserts `BookingSeat` setting `heldUntil = NOW + 5 minutes`.
    * `releaseSeat(showtimeId, seatId)` — clears `heldUntil` on cancel or expiry.
    * Expired holds (`heldUntil < NOW`) are treated as available at query time — no background cleanup job needed.
  * Merge `feature/seatmap-api` into `phase/phase6-seatmap` and delete feature branch.
* [x] Branch `feature/seatmap-ui` off `phase/phase6-seatmap`:
  * Create `SeatMap.tsx` component with row pricing badges and multi-seat selection state.
  * Integrate **SWR (`useSWR` with 5s polling)** for live availability updates.
  * Merge `feature/seatmap-ui` into `phase/phase6-seatmap` and delete feature branch.
* [x] Merge `phase/phase6-seatmap` into `develop` and preserve `phase/phase6-seatmap` on GitHub.

### ✅ Verification Checkpoint
* Open seat map in two browser tabs; select seats in Tab 1 and verify Tab 2 shows them as `HELD` within 5 seconds via SWR polling.
* Wait 5 minutes (or manually expire `heldUntil`) and confirm seats revert to `AVAILABLE` automatically.

---

## 🎟️ Phase 7: Checkout, Concurrency Transaction & Digital QR Ticket

### 🎯 Objective
Create permanent milestone branch `phase/phase7-checkout-ticket` off `develop`. Implement checkout with server-side price validation, atomic PostgreSQL transaction payment processing, and digital ticket pass generation with QR code using temporary task branches (`feature/*`).

### 📋 Checklist & Tasks
* [ ] Create milestone branch `phase/phase7-checkout-ticket` off `develop`.
* [ ] Branch `feature/checkout-flow` off `phase/phase7-checkout-ticket`:
  * Create Checkout Page (`/checkout/[showtimeId]`):
    * Seat breakdown, row prices, and total calculation (revalidated server-side).
    * Simulated payment button.
  * Build `/api/payments` POST handler using **Prisma transaction (`prisma.$transaction`)**:
    * Catch PostgreSQL unique constraint (`@@unique([showtimeId, seatId])`) to prevent double-booking.
    * Update booking status to `PAID` atomically.
  * Merge `feature/checkout-flow` into `phase/phase7-checkout-ticket` and delete feature branch.
* [ ] Branch `feature/digital-ticket` off `phase/phase7-checkout-ticket`:
  * Build Digital Ticket Pass Page (`/tickets/[id]`):
    * Install `qrcode.react` and render scannable QR code pass.
    * Display screen number, seat labels, showtime, and booking reference code.
  * Build My Tickets History Page (`/tickets`).
  * Merge `feature/digital-ticket` into `phase/phase7-checkout-ticket` and delete feature branch.
* [ ] Merge `phase/phase7-checkout-ticket` into `develop` and preserve `phase/phase7-checkout-ticket` on GitHub.

### ✅ Verification Checkpoint
* Complete a simulated checkout and verify digital pass renders with scannable QR code.
* Run concurrency test script attempting duplicate seat bookings to confirm PostgreSQL prevents double-booking.

---

## 🎥 Phase 8: Admin Panel, Camera WebCam QR Ticket Scanner & Deployment

### 🎯 Objective
Create permanent milestone branch `phase/phase8-admin-deployment` off `develop`. Implement Admin Movies & Showtimes CRUD, WebCam Camera QR Scanner for ticket verification, GitHub Actions CI/CD, and Vercel deployment. Finally merge `develop` into `main`.

### 📋 Checklist & Tasks
* [ ] Create milestone branch `phase/phase8-admin-deployment` off `develop`.
* [ ] Branch `feature/admin-movies-tmdb` off `phase/phase8-admin-deployment`:
  * Create `src/lib/tmdb.ts` — thin `fetch` wrapper for TMDB REST API (no SDK needed):
    * `searchMovies(query: string)` — calls `GET /search/movie`.
    * `getMovieDetails(tmdbId: number)` — calls `GET /movie/{id}` with `append_to_response=credits`.
    * `getNowPlayingMovies(page?: number)` — calls `GET /movie/now_playing`.
    * `getUpcomingMovies(page?: number)` — calls `GET /movie/upcoming`.
  * Create `src/services/movie-sync.service.ts` — shared ingestion & synchronization domain service:
    * Encapsulates fetching 10 Now Showing + 20 Upcoming movies from TMDB API.
    * Resolves genres, deduplicates `tmdbId`, and idempotently upserts `Movie` records.
  * Build Automated Vercel Cron Job (`src/app/api/cron/sync-movies/route.ts`):
    * `GET` handler protected by `Authorization: Bearer ${CRON_SECRET}` header validation.
    * Calls `movie-sync.service.ts` to keep the catalog fresh without manual intervention.
  * Add `vercel.json` with cron schedule configuration:
    * Path: `/api/cron/sync-movies`, Schedule: `0 0 * * 1` (weekly on Monday at midnight UTC).
  * Build Admin On-Demand Bulk Sync (`POST /api/admin/movies/sync-all`):
    * Admin-authenticated route handler triggering instant catalog sync.
  * Build Single Movie Sync (`POST /api/admin/movies/sync`):
    * Accepts `{ tmdbId: number }` in request body and imports/updates that specific title.
  * Build Admin Movies Page (`/admin/movies`):
    * 1-Click **"⚡ Sync Latest Releases"** button with live progress indicator and toast notifications.
    * TMDB search input → live results list → **Import** button per result.
    * Imported movies table with edit (title, description override) and active/deactivate toggle.
  * Add `CRON_SECRET=` and `TMDB_ACCESS_TOKEN=` to `.env.example`.
  * Merge `feature/admin-movies-tmdb` into `phase/phase8-admin-deployment` and delete feature branch.
* [ ] Branch `feature/admin-showtimes` off `phase/phase8-admin-deployment`:
  * Build Admin Dashboard (`/admin`): operational overview metrics (total movies, showtimes, revenue).
  * Build Showtimes Management Page (`/admin/showtimes`): form-based CRUD — select movie, select screen, pick date/time range, validate no overlap on same screen, submit.
  * Merge `feature/admin-showtimes` into `phase/phase8-admin-deployment` and delete feature branch.
* [ ] Branch `feature/ticket-scanner` off `phase/phase8-admin-deployment`:
  * Build Admin Ticket Scanner Page (`/admin/scanner`):
    * Install `html5-qrcode` (Browser WebCam QR scanner).
    * Build WebCam scanner component reading QR tokens + manual ticket code input fallback.
  * Build `/api/admin/verify-ticket` POST endpoint to validate and update ticket status to `USED`.
  * Merge `feature/ticket-scanner` into `phase/phase8-admin-deployment` and delete feature branch.
* [ ] Branch `feature/ci-deployment` off `phase/phase8-admin-deployment`:
  * Set up Vitest unit/integration tests and Playwright E2E tests.
  * Configure GitHub Actions CI workflow & deploy to Vercel.
  * Merge `feature/ci-deployment` into `phase/phase8-admin-deployment` and delete feature branch.
* [ ] Merge `phase/phase8-admin-deployment` into `develop` (preserving `phase/phase8-admin-deployment` on GitHub).
* [ ] Finally merge `develop` into `main` for Production Release!

### ✅ Verification Checkpoint
* Test `/api/cron/sync-movies` endpoint with valid and invalid `CRON_SECRET` tokens.
* Test Admin 1-Click Sync button and single movie search-and-import on `/admin/movies`.
* Test WebCam QR scanner with a mobile phone screen displaying a digital ticket pass. Verify ticket marks `USED`.
* Verify green build status on GitHub Actions & live Vercel production deployment URL.
