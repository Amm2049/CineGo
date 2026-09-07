# 🎬 CineGo — Cinema Ticket Booking System

A full-stack cinema ticket booking web application built with **Next.js App Router**, **TypeScript**, **Tailwind CSS**, **PostgreSQL + Prisma ORM**, **Auth.js**, and the **Google Gemini LLM API**.

---

## ✨ Features

| Feature | Status |
|---|---|
| 🤖 AI Movie Recommendations (Gemini) | Phase 6 |
| 🎬 Movie Catalog & Showtime Browser | Phase 4 |
| 💺 Interactive Seat Map + Dynamic Pricing | Phase 5 |
| 🎟️ Digital QR Ticket Pass | Phase 7 |
| 🔐 Auth + Role-Based Access | Phase 3 |
| 🗄️ PostgreSQL + Prisma ORM | Phase 2 |
| 📷 Admin WebCam QR Scanner | Phase 8 |

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS v4 + Dark Cinema Theme
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** Auth.js (NextAuth) + bcrypt
- **AI:** Google Gemini LLM API (`@google/genai`)
- **Testing:** Vitest + @testing-library/react + Playwright (E2E)
- **Deployment:** Vercel + Supabase/Neon

---

## 🚀 Getting Started

### Prerequisites
- Node.js 22+
- PostgreSQL database (local or Supabase/Neon)

### Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd cinego

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Fill in .env.local with your values

# 4. Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see CineGo.

---

## 🧪 Testing (TDD)

This project follows **Test-Driven Development (Red → Green → Refactor)**.

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# With coverage report
npm run test:coverage

# Lint check
npm run lint
```

---

## 📁 Project Structure

```
src/
├── app/                # Next.js App Router pages & API routes
│   ├── (auth)/         # Login & Register
│   ├── (customer)/     # Movies, seat map, tickets, checkout
│   ├── admin/          # Admin dashboard & QR scanner
│   └── api/            # API route handlers
├── components/         # Reusable React UI components
│   ├── ui/             # shadcn/ui primitives
│   ├── layout/         # Navbar, Footer
│   ├── movies/         # MovieCard, recommendation carousel
│   ├── seatmap/        # Interactive seat grid
│   └── admin/          # WebCam QR scanner
├── lib/                # Infrastructure & utilities
│   ├── prisma.ts       # Prisma client singleton
│   ├── auth.ts         # Auth.js configuration
│   ├── gemini.ts       # Gemini API client
│   └── utils.ts        # cn(), formatDuration(), formatPrice()
├── services/           # Business logic (separation of concerns)
├── types/              # TypeScript interfaces
└── tests/              # Unit, integration & E2E tests
```

---

## 🗺️ Development Roadmap

| Phase | Deliverable | Status |
|---|---|---|
| **Phase 1** | Project Setup & Clean Architecture | ✅ Done |
| **Phase 2** | Database Schema & Seed Data | 🔜 |
| **Phase 3** | Authentication & Security | 🔜 |
| **Phase 4** | Movie Catalog & User Profile | 🔜 |
| **Phase 5** | Seat Map & SWR Polling | 🔜 |
| **Phase 6** | AI Recommendations (Gemini) | 🔜 |
| **Phase 7** | Checkout, Concurrency & QR Ticket | 🔜 |
| **Phase 8** | Admin Panel & WebCam Scanner | 🔜 |

---

## 📄 License

MIT — Built for educational purposes at RSU Software Engineering.
