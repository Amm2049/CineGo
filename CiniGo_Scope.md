# CINEMA TICKET BOOKING SYSTEM (CineGo)
## Full Software Engineering Project Scope & MVP Specification (Version 1.3 Final)

| Metadata Field | Value |
| :--- | :--- |
| **PROJECT TITLE** | CineGo — Cinema Ticket Booking System |
| **PROJECT TYPE** | Full-Stack Software Engineering Web Application |
| **PROJECT MODEL** | Solo Project / Small Team MVP |
| **ARCHITECTURE** | Layered Monolithic Architecture (Clean Code & SE Best Practices) |
| **PRIMARY ROLES** | Customer + Admin |
| **DOCUMENT VERSION** | 1.3 (Finalized Scope, 13-Page Layout & GitFlow Workflow) |

---

## 1. Executive Summary
The **Cinema Ticket Booking System (CineGo)** is a full-stack web application built with **Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, PostgreSQL, Prisma ORM, Auth.js, and Google Gemini LLM API**. 

The platform enables customers to discover movies, view in-line AI match recommendations (`🔥 95% AI Match`), explore cinema screen formats on an Experiences FYI page, select seats on an interactive layout with dynamic row pricing, temporarily hold seats during checkout, complete a simulated payment, and receive a digital ticket pass containing a scannable QR code. Administrators manage movies, screens, showtimes, and verify customer tickets using an integrated **Camera WebCam QR Scanner**.

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
├── components/                 # Reusable React UI Components
│   ├── ui/                     # shadcn/ui primitive components (Button, Dialog, Card)
│   ├── layout/                 # Navbar, Footer, Sidebar
│   ├── movies/                 # Movie cards & in-line AI match badges
│   ├── seatmap/                # Interactive seat grid & row pricing
│   └── admin/                  # WebCam QR Ticket Scanner component
├── lib/                        # Infrastructure & Utilities
│   ├── prisma.ts               # Prisma client singleton
│   ├── auth.ts                 # Auth.js / NextAuth configuration
│   └── gemini.ts               # Google Gemini LLM API client wrapper
├── services/                   # Business Logic & Domain Services (Separation of Concerns)
│   ├── recommendation.service.ts
│   ├── booking.service.ts
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
| **AI Recommendation** | Google Gemini LLM API (`@google/genai`) | Structured JSON generation for movie match scores (%) and 1-sentence AI explanations rendered as **In-Line Badges**. |
| **Authentication** | Auth.js (NextAuth) + bcrypt | Hashed credentials & role-based route protection (`CUSTOMER`, `ADMIN`). |
| **QR Code System** | `qrcode.react` + `html5-qrcode` | `qrcode.react` renders ticket QR codes; `html5-qrcode` powers the WebCam Scanner. |
| **Media Handling** | External Image URLs | Movie poster (portrait) & hero/backdrop (landscape) images linked via CDN/Unsplash/TMDB URLs. |
| **Testing & CI/CD** | Vitest + Playwright + GitHub Actions | Unit, integration, E2E, and concurrency testing with automated CI on Vercel. |

---

## 4. Final 13-Page Inventory & Feature Scope

### 🌐 4.1 Customer Pages (7 Pages)
1. **Homepage (`/`):** Hero Banner (featured blockbuster) + 5-card Now Screening preview + 5-card Anticipated Premieres preview (both with in-line `🔥 {matchScore}%` AI recommendation badges and fully clickable cards without inner button clutter) + *"View All Movies →"* and *"Explore All Upcoming →"* CTAs.
2. **Movies Catalog Page (`/movies`):** Clean 2-tab view (`[ 🍿 Now Screening ]` vs `[ 📅 Upcoming Releases ]`) displaying active cinema movies with AI match badges.
3. **Experiences FYI Page (`/experiences`):** Informational page highlighting cinema screen formats (IMAX Laser, Dolby Cinema, 4DX Motion, VIP Lounge).
4. **Seat Selection & Checkout (`/checkout/[showtimeId]`):** Interactive seat map, dynamic row pricing, 5-minute seat hold timer (`heldUntil`), SWR polling, and simulated payment confirmation.
5. **Digital Ticket Pass (`/tickets/[id]`):** Rendered scannable QR code pass (`qrcode.react`), seat details, screen number, and booking reference.
6. **My Tickets & History (`/tickets`):** View active upcoming passes and past booking history.
7. **Profile & Genre Preferences (`/profile`):** Manage account details & select/update favorite genres for AI recommendations.

### 🔐 4.2 Authentication Pages (2 Pages)
8. **Login Page (`/login`):** Account sign-in form with Auth.js credentials.
9. **Register Page (`/register`):** Account sign-up form with bcrypt password hashing.

### 🛠️ 4.3 Admin Pages (4 Pages)
10. **Admin Dashboard (`/admin`):** Operational overview metrics (total movies, showtimes, revenue).
11. **Manage Movies (`/admin/movies`):** Add, edit, or deactivate movies, poster URLs, and backdrop URLs.
12. **Manage Showtimes (`/admin/showtimes`):** Create showtime schedules per screen with overlap validation.
13. **WebCam QR Ticket Scanner (`/admin/scanner`):** Live camera WebCam QR scanner (`html5-qrcode`) + manual ticket code input fallback to verify entry (`VALID`, `INVALID`, `ALREADY USED`).

---

## 5. Functional Requirements (FR)

* **FR-01 (Auth):** Passwords stored as bcrypt hashes; roles enforced server-side.
* **FR-02 (In-Line AI Recommendations):** `/api/recommendations` invokes Gemini API with user interests & booking history, returning structured JSON (`movieId`, `matchScore`, `reason`) rendered as glowing **In-Line AI Match Badges** on movie cards.
* **FR-03 (Movie & Showtime Browsing):** Customers browse movies on `/` and `/movies`, and view showtimes per screen.
* **FR-04 (Experiences FYI):** Informational page (`/experiences`) explaining screen technologies (IMAX, Dolby, 4DX, VIP).
* **FR-05 (Seat Selection & Dynamic Pricing):** Interactive seat map calculates price totals based on row pricing rules.
* **FR-06 (Concurrency & Holds):** Seats held for 5 minutes via `heldUntil`. Database transaction guarantees atomic confirmation. `@@unique([showtimeId, seatId])` prevents double-booking.
* **FR-07 (Digital Ticket & QR):** Paid bookings generate digital tickets with rendered QR code passes.
* **FR-08 (Admin Scanner & CRUD):** Admin WebCam QR Scanner reads QR tokens or manual ticket codes and displays ticket validation results. Admin manages Movies, Screens, and Showtimes.

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

enum PaymentStatus {
  SUCCESS
  FAILED
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
4. **AI Recommendation Badges:** Gemini LLM API integration rendering in-line AI match badges and 1-sentence insights.
5. **Seat Concurrency Protection:** PostgreSQL transaction and constraint protection against double-booking.
6. **Digital QR Ticket & WebCam Scanner:** Working digital ticket with rendered QR code and an Admin Camera WebCam ticket scanner.
7. **Testing Suite:** Automated unit/integration tests with Vitest and E2E concurrency tests with Playwright.
