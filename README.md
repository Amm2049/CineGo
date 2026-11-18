# 🎬 CineGo: Cinema Ticket Booking System

CineGo is a full-stack web app for booking cinema tickets. Customers browse movies, pick a showtime, choose seats on a live seat map, pay with PromptPay, and get one QR ticket per seat. Staff scan the tickets at the door, and admins manage movies and showtimes.

**Live demo:** https://cinego-nu.vercel.app (Stripe **test mode**, so no real money is charged)

Built for the Software Engineering course at Rangsit University (RSU).

---

## ✨ Features

**Customers**
- Browse **Now Showing** and **Coming Soon** movies (synced from TMDB with Thai release dates), with trailers
- Pick a day and time on the movie page, then choose seats on a **live seat map**
  - 4 theatres × 60 seats, three price tiers: Standard ฿150 (front), Premium ฿200, VIP ฿280 (back)
  - Seats are **held for you** while you pay, so two customers can never buy the same seat
- Pay with **PromptPay** through Stripe (QR code, confirmed by webhook)
- **One QR ticket per seat**, listed under *My Tickets*
- **AI match badges** (Google Gemini) based on favourite genres and booking history
- Sign up with email + password or **Continue with Google**

**Staff**
- **QR scanner** in the browser (webcam). One scan admits one seat, and a ticket can't be used twice or too early

**Admins**
- Manage movies: sync the latest releases from TMDB, hide or show a movie
- Manage showtimes: the server blocks clashes (25-minute cleaning buffer), past times, and shows before a movie's release day
- Dashboard with tickets sold

---

## 🛠️ Tech Stack

| Area | Tools |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL (Neon) + Prisma 7 |
| Auth | NextAuth (credentials + Google), bcrypt, role-based access (Customer / Staff / Admin) |
| Payments | Stripe PromptPay (test mode), with a simulated provider for local work and CI |
| External APIs | TMDB (movies, trailers), Google Gemini (recommendations) |
| Testing | Vitest + Testing Library (unit, integration), Playwright (end-to-end) |
| CI/CD | GitHub Actions, Vercel (region `sin1`, Singapore) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 22+
- A PostgreSQL database (local, or a free [Neon](https://neon.tech) project)
- Optional keys: TMDB (live movies; without it the seed uses built-in movies), Gemini, Google sign-in, Stripe

### Setup

```bash
git clone https://github.com/Amm2049/CineGo.git
cd CineGo
npm install                      # also runs prisma generate

cp .env.example .env             # then fill in the values (see comments in the file)

npx prisma migrate deploy        # create the tables
npx prisma db seed               # demo cinema, seats, movies, showtimes and accounts
npm run dev                      # http://localhost:3000
```

> ⚠️ The seed **deletes all data** before it fills the database. Never run it against production.

### Demo accounts (local seed only)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@cinego.com` | `admin123` |
| Staff | `staff@cinego.com` | `staff123` |

Customers register on the site. Production uses different passwords.

### Payments

- Leave `PAYMENT_PROVIDER` empty to use the **simulated** payment (no Stripe needed).
- Set `PAYMENT_PROVIDER=stripe` plus test keys to use **Stripe PromptPay**. Run `npm run stripe:listen` to forward webhooks locally. Live keys are refused on purpose.

---

## 🧪 Testing

| Command | What it runs |
|---|---|
| `npm test` | Unit tests (Vitest) |
| `npm run test:integration` | Payment and booking services against a real database |
| `npm run test:concurrency` | Races seat holds and payments to prove no seat is sold twice |
| `npm run test:e2e` | End-to-end browser tests (Playwright) |
| `npm run lint` | ESLint |

CI (GitHub Actions) runs all of these on every push to `main`, `develop`, `phase/**` and `feature/**`, against a fresh Postgres 16 database.

---

## 📁 Project Structure

```
prisma/              schema, migrations, seed
scripts/             production setup, dev tools, Vercel build
src/
├── app/             pages and API routes (Next.js App Router)
│   ├── (auth)/          login, register
│   ├── (customer)/      movies, checkout (seat map), tickets, profile
│   ├── admin/           dashboard, movies, showtimes, scanner
│   └── api/             REST endpoints, Stripe webhook, cron
├── components/      UI by feature (seatmap, checkout, tickets, admin, …)
├── services/        business logic (booking, payment, seat, showtime, …)
├── lib/             auth, Prisma client, Stripe, TMDB, Gemini, helpers
└── tests/           unit and integration tests
e2e/                 Playwright tests
```

---

## ☁️ Deployment

- Every push to `main` deploys to Vercel. The build runs `prisma migrate deploy` first.
- Production has its own Neon database. Fill an empty one with `npm run setup:production` (a dry run that only shows what would change), then `npm run setup:production -- --apply` (only adds, never deletes).
- A weekly Vercel cron (`/api/cron/sync-movies`, Mondays) refreshes movies from TMDB.

---

## 🌿 Branches

`feature/*` → `phase/phaseN-*` → `develop` → `main`

The `phase/phase1-setup` … `phase/phase10-testing` branches keep the history of each development phase.

| Phase | Deliverable |
|---|---|
| 1 | Project setup |
| 2 | Database schema and seed data |
| 3 | Authentication and roles |
| 4 | Movie catalogue (TMDB) |
| 5 | AI recommendations (Gemini) |
| 6 | Live seat map and seat holds |
| 7 | Checkout and QR tickets |
| 8 | Admin panel, scanner, deployment |
| 9 | Stripe PromptPay payments |
| 10 | Testing and polish |

---

## 👥 Team

| Member | Role |
|---|---|
| Grace | Project Manager, System Analyst, Business Analyst |
| Billy | Developer |
| Kimmy | Tester / QA |

---

## 📄 License

MIT. Built for educational purposes at Rangsit University.
