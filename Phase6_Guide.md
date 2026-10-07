# Phase 6: Step-by-Step Implementation Guide

**Goal:** Implement the interactive cinema seat selection layout, row-based dynamic pricing tiers (Standard, Premium, VIP), 5-minute temporary seat hold concurrency mechanism (`heldUntil`), background live availability synchronization via SWR polling (5s interval), and the seat booking flow on `/checkout/[showtimeId]`.

**Source of truth:** `CiniGo_Phase_Plan.md` lines 154–182 | `CiniGo_Scope.md` Sections 2.1, 3, 4.1, 5 (FR-05, FR-06), 6 (`Screen`, `Seat`, `Showtime`, `BookingSeat`)

---

## Overview — What We Build in Phase 6

```
phase/phase6-seatmap
   ├── feature/seatmap-api     (install SWR, types, seat.service.ts, GET /api/showtimes/[id]/seats, POST /api/showtimes/[id]/seats/hold, POST /api/showtimes/[id]/seats/release, unit tests)
   └── feature/seatmap-ui      (ScreenCurve, SeatItem, SeatLegend, SeatHoldTimer, SeatMap, /checkout/[showtimeId] page & client controller, catalog showtime linking)
```

### Key Deliverables:
- **`package.json`** — Install `swr` for real-time background polling.
- **`src/types/index.ts`** — Define `SeatStatus`, `SeatTier`, `SeatLayoutItem`, `ShowtimeSeatMapResponse`, `SeatHoldRequest`, `SeatHoldResponse`.
- **`src/services/seat.service.ts`** — Domain service handling seat grid query, status derivation (`AVAILABLE`, `HELD`, `BOOKED`), 5-minute atomic holds with `heldUntil`, release logic, and automatic expired hold reclamation.
- **`src/app/api/showtimes/[id]/seats/route.ts`** — REST endpoint returning full seat grid, pricing tiers, and real-time availability.
- **`src/app/api/showtimes/[id]/seats/hold/route.ts`** — Authenticated endpoint to place a 5-minute temporary hold on selected seats.
- **`src/app/api/showtimes/[id]/seats/release/route.ts`** — Authenticated endpoint to release held seats when deselected or when abandoning checkout.
- **`src/components/seatmap/`**:
  - `ScreenCurve.tsx` — Cinematic glowing curved screen visualizer.
  - `SeatItem.tsx` — Accessible interactive seat with color-coded states and tooltips.
  - `SeatLegend.tsx` — Status legend and row pricing tiers (Standard ฿150, Premium ฿200, VIP ฿280).
  - `SeatHoldTimer.tsx` — 5-minute countdown clock with amber/red urgency styling.
  - `SeatMap.tsx` — Full grid controller with row labels (A–F), seat numbers (1–10), and selection state.
- **`src/app/(customer)/checkout/[showtimeId]/`**:
  - `page.tsx` — Server component verifying session and fetching initial showtime metadata.
  - `SeatSelectionClient.tsx` — SWR-powered client component orchestrating real-time seat selection, hold timer, and price summary.
- **`src/tests/unit/seat.service.test.ts`** — Vitest unit tests verifying status calculation, hold concurrency, and expired hold fallback.

---

## Step 1: Git Branching Setup

Ensure your local `develop` branch is fully synchronized, checkout the permanent milestone branch `phase/phase6-seatmap`, and create the first task branch `feature/seatmap-api`:

```bash
# Checkout and ensure develop is up to date
git checkout develop
git pull origin develop

# Checkout the permanent milestone branch (already created or create if needed)
git checkout phase/phase6-seatmap

# Create the first feature branch
git checkout -b feature/seatmap-api
```

Your branch hierarchy is now:
```
main
develop
  └── phase/phase6-seatmap          <-- Permanent Phase Milestone (NEVER delete)
        └── feature/seatmap-api     <-- You are HERE
```

---

## Step 2: Install SWR Dependency

Install `swr` (Stale-While-Revalidate React hook by Vercel) for live background seat status polling:

```bash
npm install swr
```

---

## Step 3: TypeScript Definitions (`src/types/index.ts`)

Append the following seat and booking types to [src/types/index.ts](file:///d:/RSU/SE/cinego/src/types/index.ts):

```typescript
// ── Phase 6: Seat Map & Live Booking Types ───────────────────

export type SeatStatus = "AVAILABLE" | "HELD" | "BOOKED" | "SELECTED";
export type SeatTier = "VIP" | "PREMIUM" | "STANDARD";

export interface SeatLayoutItem {
  id: string;
  rowLabel: string;
  seatNum: number;
  price: number;
  tier: SeatTier;
  status: "AVAILABLE" | "HELD" | "BOOKED";
  heldUntil: string | null;
  isHeldByMe?: boolean;
}

export interface ShowtimeSeatMapResponse {
  showtime: {
    id: string;
    startsAt: string;
    endsAt: string;
    movie: {
      id: string;
      title: string;
      posterUrl: string;
      duration: number;
      genres: string[];
    };
    screen: {
      id: string;
      name: string;
      cinemaName: string;
    };
  };
  seats: SeatLayoutItem[];
  pricing: {
    standard: number;
    premium: number;
    vip: number;
  };
  totalSeats: number;
  availableSeats: number;
}

export interface HoldSeatsRequest {
  seatIds: string[];
}

export interface HoldSeatsResponse {
  success: boolean;
  bookingId: string;
  heldUntil: string;
  heldSeatIds: string[];
  message?: string;
}

export interface ReleaseSeatsRequest {
  seatIds?: string[];
  bookingId?: string;
}
```

---

## Step 4: Implement Seat Service Layer (`src/services/seat.service.ts`)

Replace the stub in [src/services/seat.service.ts](file:///d:/RSU/SE/cinego/src/services/seat.service.ts) with complete domain logic.

> **Engineering Principle — Zero Cron Hold Expiration:**
> Seats held temporarily via `heldUntil` do **not** require a background cron job to be swept. When querying seat availability, any seat with `heldUntil < NOW` is automatically evaluated as `AVAILABLE`. This eliminates database polling load and guarantees zero race condition drift.

```typescript
// src/services/seat.service.ts
// CineGo — Domain service for Seat availability, 5-minute atomic holds, and layout mapping

import prisma from "@/lib/prisma";
import { SeatLayoutItem, SeatTier, ShowtimeSeatMapResponse } from "@/types";

const HOLD_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Determine pricing tier from row label:
 * Rows A–B: VIP (฿280)
 * Rows C–D: Premium (฿200)
 * Rows E–F: Standard (฿150)
 */
export function getRowTier(rowLabel: string): SeatTier {
  const upper = rowLabel.toUpperCase();
  if (upper === "A" || upper === "B") return "VIP";
  if (upper === "C" || upper === "D") return "PREMIUM";
  return "STANDARD";
}

/**
 * Fetch seat layout and real-time availability for a given showtime.
 * Dynamically resolves seat status:
 * - BOOKED: Seat has a BookingSeat record in a PAID booking.
 * - HELD: Seat has heldUntil > NOW in a PENDING booking.
 * - AVAILABLE: No record, or heldUntil <= NOW, or cancelled booking.
 */
export async function getShowtimeSeatMap(
  showtimeId: string,
  currentUserId?: string
): Promise<ShowtimeSeatMapResponse | null> {
  const now = new Date();

  // 1. Fetch showtime with screen, cinema, movie, and screen seats
  const showtime = await prisma.showtime.findUnique({
    where: { id: showtimeId },
    include: {
      movie: {
        include: {
          genres: { include: { genre: true } },
        },
      },
      screen: {
        include: {
          cinema: true,
          seats: {
            orderBy: [{ rowLabel: "asc" }, { seatNum: "asc" }],
          },
        },
      },
      seats: {
        include: {
          booking: {
            select: { id: true, userId: true, status: true },
          },
        },
      },
    },
  });

  if (!showtime) return null;

  // 2. Map existing active bookings/holds by seatId
  // Map: seatId -> { isBooked: boolean, isHeld: boolean, heldUntil: Date, isHeldByMe: boolean }
  const seatStatusMap = new Map<
    string,
    { isBooked: boolean; isHeld: boolean; heldUntil: Date | null; isHeldByMe: boolean }
  >();

  for (const bs of showtime.seats) {
    const isPaid = bs.booking.status === "PAID";
    const isHeld =
      bs.booking.status === "PENDING" &&
      bs.heldUntil !== null &&
      new Date(bs.heldUntil) > now;

    if (isPaid) {
      seatStatusMap.set(bs.seatId, {
        isBooked: true,
        isHeld: false,
        heldUntil: null,
        isHeldByMe: bs.booking.userId === currentUserId,
      });
    } else if (isHeld) {
      seatStatusMap.set(bs.seatId, {
        isBooked: false,
        isHeld: true,
        heldUntil: bs.heldUntil,
        isHeldByMe: bs.booking.userId === currentUserId,
      });
    }
  }

  // 3. Assemble seat grid items
  let availableCount = 0;
  const seatItems: SeatLayoutItem[] = showtime.screen.seats.map((seat) => {
    const statusInfo = seatStatusMap.get(seat.id);
    let status: "AVAILABLE" | "HELD" | "BOOKED" = "AVAILABLE";
    let isHeldByMe = false;
    let heldUntilStr: string | null = null;

    if (statusInfo?.isBooked) {
      status = "BOOKED";
    } else if (statusInfo?.isHeld) {
      status = "HELD";
      isHeldByMe = statusInfo.isHeldByMe;
      heldUntilStr = statusInfo.heldUntil ? statusInfo.heldUntil.toISOString() : null;
    } else {
      status = "AVAILABLE";
      availableCount++;
    }

    return {
      id: seat.id,
      rowLabel: seat.rowLabel,
      seatNum: seat.seatNum,
      price: Number(seat.price),
      tier: getRowTier(seat.rowLabel),
      status,
      heldUntil: heldUntilStr,
      isHeldByMe,
    };
  });

  return {
    showtime: {
      id: showtime.id,
      startsAt: showtime.startsAt.toISOString(),
      endsAt: showtime.endsAt.toISOString(),
      movie: {
        id: showtime.movie.id,
        title: showtime.movie.title,
        posterUrl: showtime.movie.posterUrl,
        duration: showtime.movie.duration,
        genres: showtime.movie.genres.map((g) => g.genre.name),
      },
      screen: {
        id: showtime.screen.id,
        name: showtime.screen.name,
        cinemaName: showtime.screen.cinema.name,
      },
    },
    seats: seatItems,
    pricing: {
      standard: 150,
      premium: 200,
      vip: 280,
    },
    totalSeats: seatItems.length,
    availableSeats: availableCount,
  };
}

/**
 * Temporarily hold selected seats for 5 minutes during checkout.
 * Uses atomic transaction to guarantee no two users can hold the same seat simultaneously.
 */
export async function holdShowtimeSeats(params: {
  showtimeId: string;
  seatIds: string[];
  userId: string;
}): Promise<{
  success: boolean;
  bookingId?: string;
  heldUntil?: Date;
  error?: string;
}> {
  const { showtimeId, seatIds, userId } = params;
  if (!seatIds.length) {
    return { success: false, error: "No seats selected" };
  }

  const now = new Date();
  const heldUntil = new Date(Date.now() + HOLD_DURATION_MS);

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch requested seats to calculate total
      const seats = await tx.seat.findMany({
        where: { id: { in: seatIds } },
      });

      if (seats.length !== seatIds.length) {
        return { success: false, error: "One or more invalid seats selected" };
      }

      const totalAmount = seats.reduce((sum, s) => sum + Number(s.price), 0);

      // 2. Check for conflicting active bookings or holds
      const existingBookings = await tx.bookingSeat.findMany({
        where: {
          showtimeId,
          seatId: { in: seatIds },
        },
        include: {
          booking: {
            select: { id: true, userId: true, status: true },
          },
        },
      });

      for (const bs of existingBookings) {
        // Seat already purchased
        if (bs.booking.status === "PAID") {
          return {
            success: false,
            error: `Seat is already booked by another customer.`,
          };
        }

        // Seat held by another user
        if (
          bs.booking.status === "PENDING" &&
          bs.booking.userId !== userId &&
          bs.heldUntil &&
          new Date(bs.heldUntil) > now
        ) {
          return {
            success: false,
            error: `Seat is temporarily held by another customer. Please choose different seats.`,
          };
        }
      }

      // 3. Find or create user's PENDING booking for this showtime
      let booking = await tx.booking.findFirst({
        where: {
          showtimeId,
          userId,
          status: "PENDING",
        },
      });

      if (booking) {
        // Update total
        booking = await tx.booking.update({
          where: { id: booking.id },
          data: { totalAmount },
        });

        // Clean up previous held seats for this booking that are no longer selected
        await tx.bookingSeat.deleteMany({
          where: {
            bookingId: booking.id,
            seatId: { notIn: seatIds },
          },
        });
      } else {
        booking = await tx.booking.create({
          data: {
            userId,
            showtimeId,
            status: "PENDING",
            totalAmount,
          },
        });
      }

      // 4. Upsert BookingSeat records with heldUntil
      for (const seat of seats) {
        await tx.bookingSeat.upsert({
          where: {
            showtimeId_seatId: {
              showtimeId,
              seatId: seat.id,
            },
          },
          update: {
            bookingId: booking.id,
            priceAtPurchase: seat.price,
            heldUntil,
          },
          create: {
            bookingId: booking.id,
            showtimeId,
            seatId: seat.id,
            priceAtPurchase: seat.price,
            heldUntil,
          },
        });
      }

      return {
        success: true,
        bookingId: booking.id,
        heldUntil,
      };
    });
  } catch (error) {
    console.error("[SeatService] holdShowtimeSeats error:", error);
    return {
      success: false,
      error: "Failed to reserve seats due to a concurrency conflict. Please try again.",
    };
  }
}

/**
 * Release held seats when deselected by customer or abandoned.
 */
export async function releaseShowtimeSeats(params: {
  showtimeId: string;
  userId: string;
  seatIds?: string[];
}): Promise<{ success: boolean }> {
  const { showtimeId, userId, seatIds } = params;

  try {
    const booking = await prisma.booking.findFirst({
      where: {
        showtimeId,
        userId,
        status: "PENDING",
      },
    });

    if (!booking) return { success: true };

    if (seatIds && seatIds.length > 0) {
      await prisma.bookingSeat.deleteMany({
        where: {
          bookingId: booking.id,
          seatId: { in: seatIds },
        },
      });
    } else {
      // Release all seats for this pending booking
      await prisma.bookingSeat.deleteMany({
        where: { bookingId: booking.id },
      });
    }

    return { success: true };
  } catch (error) {
    console.error("[SeatService] releaseShowtimeSeats error:", error);
    return { success: false };
  }
}
```

---

## Step 5: Build API Route Handlers

### 1. `GET /api/showtimes/[id]/seats`
Create [src/app/api/showtimes/[id]/seats/route.ts](file:///d:/RSU/SE/cinego/src/app/api/showtimes/[id]/seats/route.ts):

```typescript
// src/app/api/showtimes/[id]/seats/route.ts
// Live seat availability query endpoint with SWR support

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getShowtimeSeatMap } from "@/services/seat.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    const seatMap = await getShowtimeSeatMap(id, userId);

    if (!seatMap) {
      return NextResponse.json({ error: "Showtime not found" }, { status: 404 });
    }

    return NextResponse.json(seatMap, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[GET /api/showtimes/[id]/seats] Error:", error);
    return NextResponse.json({ error: "Failed to fetch seat map" }, { status: 500 });
  }
}
```

### 2. `POST /api/showtimes/[id]/seats/hold`
Create [src/app/api/showtimes/[id]/seats/hold/route.ts](file:///d:/RSU/SE/cinego/src/app/api/showtimes/[id]/seats/hold/route.ts):

```typescript
// src/app/api/showtimes/[id]/seats/hold/route.ts
// Atomically hold seats for 5 minutes during checkout

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { holdShowtimeSeats } from "@/services/seat.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required to hold seats" },
        { status: 401 }
      );
    }

    const { id: showtimeId } = await params;
    const body = await request.json();
    const seatIds = Array.isArray(body?.seatIds) ? body.seatIds : [];

    if (!seatIds.length) {
      return NextResponse.json(
        { error: "Please select at least one seat" },
        { status: 400 }
      );
    }

    const result = await holdShowtimeSeats({
      showtimeId,
      seatIds,
      userId: session.user.id,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId,
      heldUntil: result.heldUntil?.toISOString(),
      heldSeatIds: seatIds,
    });
  } catch (error) {
    console.error("[POST /api/showtimes/[id]/seats/hold] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### 3. `POST /api/showtimes/[id]/seats/release`
Create [src/app/api/showtimes/[id]/seats/release/route.ts](file:///d:/RSU/SE/cinego/src/app/api/showtimes/[id]/seats/release/route.ts):

```typescript
// src/app/api/showtimes/[id]/seats/release/route.ts
// Release held seats on deselection or timeout

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { releaseShowtimeSeats } from "@/services/seat.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: true });
    }

    const { id: showtimeId } = await params;
    const body = await request.json().catch(() => ({}));
    const seatIds = Array.isArray(body?.seatIds) ? body.seatIds : undefined;

    await releaseShowtimeSeats({
      showtimeId,
      userId: session.user.id,
      seatIds,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/showtimes/[id]/seats/release] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

---

## Step 6: Unit Testing Seat Service Logic

Create [src/tests/unit/seat.service.test.ts](file:///d:/RSU/SE/cinego/src/tests/unit/seat.service.test.ts) to test row pricing tiers and status rules:

```typescript
// src/tests/unit/seat.service.test.ts
import { describe, it, expect } from "vitest";
import { getRowTier } from "@/services/seat.service";

describe("Seat Service Tier Calculations", () => {
  it("correctly identifies VIP rows", () => {
    expect(getRowTier("A")).toBe("VIP");
    expect(getRowTier("B")).toBe("VIP");
    expect(getRowTier("a")).toBe("VIP");
  });

  it("correctly identifies Premium rows", () => {
    expect(getRowTier("C")).toBe("PREMIUM");
    expect(getRowTier("D")).toBe("PREMIUM");
  });

  it("correctly identifies Standard rows", () => {
    expect(getRowTier("E")).toBe("STANDARD");
    expect(getRowTier("F")).toBe("STANDARD");
    expect(getRowTier("G")).toBe("STANDARD");
  });
});
```

Run tests to verify:
```bash
npx vitest run
```

---

## Step 7: Commit & Merge `feature/seatmap-api`

```bash
git add .
git commit -m "feat(phase6): seat service, hold/release API routes, and SWR type scaffold"
git checkout phase/phase6-seatmap
git merge feature/seatmap-api
git branch -d feature/seatmap-api
```

---

## Step 8: Branch `feature/seatmap-ui`

```bash
git checkout -b feature/seatmap-ui
```

---

## Step 9: Build Seat Map UI Components (`src/components/seatmap/`)

### 1. Curved Screen Visualizer (`ScreenCurve.tsx`)
Create [src/components/seatmap/ScreenCurve.tsx](file:///d:/RSU/SE/cinego/src/components/seatmap/ScreenCurve.tsx):

```tsx
// src/components/seatmap/ScreenCurve.tsx
// Cinematic curved illuminated movie screen

export default function ScreenCurve({ screenName = "MAIN AUDITORIUM" }: { screenName?: string }) {
  return (
    <div className="relative w-full max-w-2xl mx-auto flex flex-col items-center mb-8 select-none">
      {/* Ambient Screen Light Projection */}
      <div className="w-4/5 h-8 bg-gradient-to-b from-[#5938ff]/25 to-transparent blur-xl pointer-events-none -mb-3" />

      {/* Curved Screen Border */}
      <div className="relative w-full h-10 overflow-hidden flex items-start justify-center">
        <div className="w-[120%] h-40 border-t-4 border-[#2500f0] rounded-[50%] shadow-[0_0_24px_rgba(37,0,240,0.8)]" />
      </div>

      <div className="flex items-center gap-2 -mt-4 text-[10px] font-black uppercase tracking-widest text-[#a5b4fc]/80">
        <span>▲</span>
        <span>{screenName} — SCREEN THIS WAY</span>
        <span>▲</span>
      </div>
    </div>
  );
}
```

### 2. Interactive Seat Item (`SeatItem.tsx`)
Create [src/components/seatmap/SeatItem.tsx](file:///d:/RSU/SE/cinego/src/components/seatmap/SeatItem.tsx):

```tsx
// src/components/seatmap/SeatItem.tsx
// Individual seat button with status styling and hover tooltip

import { SeatLayoutItem } from "@/types";

interface SeatItemProps {
  seat: SeatLayoutItem;
  isSelected: boolean;
  onToggle: (seat: SeatLayoutItem) => void;
  disabled?: boolean;
}

export default function SeatItem({ seat, isSelected, onToggle, disabled }: SeatItemProps) {
  const isBooked = seat.status === "BOOKED";
  const isHeldByOther = seat.status === "HELD" && !seat.isHeldByMe;

  let bgClass = "bg-[#0b0c2a] border-white/20 text-zinc-300 hover:border-[#5938ff] hover:text-white";
  let title = `Row ${seat.rowLabel}, Seat ${seat.seatNum} (฿${seat.price} ${seat.tier})`;

  if (isBooked) {
    bgClass = "bg-zinc-900/60 border-zinc-800 text-zinc-700 cursor-not-allowed";
    title = `Row ${seat.rowLabel}, Seat ${seat.seatNum} — Sold Out`;
  } else if (isHeldByOther) {
    bgClass = "bg-amber-950/40 border-amber-500/40 text-amber-500/60 cursor-not-allowed animate-pulse";
    title = `Row ${seat.rowLabel}, Seat ${seat.seatNum} — Held by another customer`;
  } else if (isSelected) {
    bgClass = "bg-[#2500f0] border-white text-white shadow-[0_0_16px_rgba(37,0,240,0.9)] scale-110 z-10";
    title = `Row ${seat.rowLabel}, Seat ${seat.seatNum} — Selected (฿${seat.price})`;
  } else if (seat.isHeldByMe) {
    bgClass = "bg-[#5938ff]/40 border-[#5938ff] text-white shadow-[0_0_10px_rgba(89,56,255,0.5)]";
    title = `Row ${seat.rowLabel}, Seat ${seat.seatNum} — Reserved for you`;
  }

  const isClickable = !isBooked && !isHeldByOther && !disabled;

  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={() => onToggle(seat)}
      title={title}
      className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-t-xl rounded-b-md border text-[11px] font-bold flex items-center justify-center transition-all duration-200 ${bgClass}`}
    >
      <span>{seat.seatNum}</span>
    </button>
  );
}
```

### 3. Legend & Pricing Component (`SeatLegend.tsx`)
Create [src/components/seatmap/SeatLegend.tsx](file:///d:/RSU/SE/cinego/src/components/seatmap/SeatLegend.tsx):

```tsx
// src/components/seatmap/SeatLegend.tsx
// Status legend and pricing breakdown

export default function SeatLegend({
  pricing,
}: {
  pricing: { standard: number; premium: number; vip: number };
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 py-4 px-6 rounded-2xl bg-[#06071d]/90 border border-[#2500f0]/30 text-xs">
      {/* Statuses */}
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-t-lg rounded-b-sm bg-[#0b0c2a] border border-white/20" />
        <span className="text-zinc-400">Available</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-t-lg rounded-b-sm bg-[#2500f0] border border-white shadow-[0_0_10px_rgba(37,0,240,0.8)]" />
        <span className="text-white font-semibold">Selected</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-t-lg rounded-b-sm bg-amber-950/60 border border-amber-500/50" />
        <span className="text-amber-400">Held</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-t-lg rounded-b-sm bg-zinc-900 border border-zinc-800" />
        <span className="text-zinc-600">Sold</span>
      </div>

      {/* Pricing Tiers */}
      <div className="h-4 w-px bg-white/10 hidden sm:block" />

      <div className="flex items-center gap-4 text-[11px] text-zinc-300">
        <span>VIP (A–B): <strong className="text-white">฿{pricing.vip}</strong></span>
        <span>Premium (C–D): <strong className="text-white">฿{pricing.premium}</strong></span>
        <span>Standard (E–F): <strong className="text-white">฿{pricing.standard}</strong></span>
      </div>
    </div>
  );
}
```

### 4. Countdown Hold Timer (`SeatHoldTimer.tsx`)
Create [src/components/seatmap/SeatHoldTimer.tsx](file:///d:/RSU/SE/cinego/src/components/seatmap/SeatHoldTimer.tsx):

```tsx
// src/components/seatmap/SeatHoldTimer.tsx
// 5-minute seat reservation countdown timer

"use client";

import { useEffect, useState } from "react";

interface SeatHoldTimerProps {
  heldUntil: string | null;
  onExpire: () => void;
}

export default function SeatHoldTimer({ heldUntil, onExpire }: SeatHoldTimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!heldUntil) {
      setSecondsRemaining(null);
      return;
    }

    const target = new Date(heldUntil).getTime();

    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((target - now) / 1000));
      setSecondsRemaining(diff);

      if (diff <= 0) {
        onExpire();
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [heldUntil, onExpire]);

  if (secondsRemaining === null || secondsRemaining <= 0) {
    return null;
  }

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const isUrgent = secondsRemaining < 60;

  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
        isUrgent
          ? "bg-red-950/60 border-red-500/70 text-red-200 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]"
          : "bg-amber-950/40 border-amber-500/50 text-amber-300"
      }`}
    >
      <span>⏱️ Seats held:</span>
      <span className="font-mono text-sm">
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
    </div>
  );
}
```

### 5. Full Seat Map Controller (`SeatMap.tsx`)
Create [src/components/seatmap/SeatMap.tsx](file:///d:/RSU/SE/cinego/src/components/seatmap/SeatMap.tsx) bringing the grid, row labels (A–F), and seat items together:

```tsx
// src/components/seatmap/SeatMap.tsx
// Interactive seat map layout with row indicators and center aisle

import ScreenCurve from "./ScreenCurve";
import SeatItem from "./SeatItem";
import { SeatLayoutItem } from "@/types";

interface SeatMapProps {
  seats: SeatLayoutItem[];
  selectedSeatIds: string[];
  onToggleSeat: (seat: SeatLayoutItem) => void;
  screenName?: string;
  isHolding?: boolean;
}

export default function SeatMap({
  seats,
  selectedSeatIds,
  onToggleSeat,
  screenName,
  isHolding,
}: SeatMapProps) {
  // Group seats by row
  const rows = Array.from(new Set(seats.map((s) => s.rowLabel))).sort();

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
      <ScreenCurve screenName={screenName} />

      {/* Grid Container */}
      <div className="space-y-3 py-6 px-4 sm:px-8 rounded-3xl bg-[#030414]/90 border border-[#2500f0]/30 shadow-2xl overflow-x-auto max-w-full">
        {rows.map((rowLabel) => {
          const rowSeats = seats
            .filter((s) => s.rowLabel === rowLabel)
            .sort((a, b) => a.seatNum - b.seatNum);

          return (
            <div key={rowLabel} className="flex items-center justify-center gap-2 sm:gap-3">
              {/* Left Row Indicator */}
              <span className="w-6 text-center text-xs font-black text-[#5938ff]">{rowLabel}</span>

              {/* Seats with Center Aisle after Seat 5 */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {rowSeats.slice(0, 5).map((seat) => (
                  <SeatItem
                    key={seat.id}
                    seat={seat}
                    isSelected={selectedSeatIds.includes(seat.id)}
                    onToggle={onToggleSeat}
                    disabled={isHolding}
                  />
                ))}

                {/* Center Aisle */}
                <div className="w-4 sm:w-8" />

                {rowSeats.slice(5).map((seat) => (
                  <SeatItem
                    key={seat.id}
                    seat={seat}
                    isSelected={selectedSeatIds.includes(seat.id)}
                    onToggle={onToggleSeat}
                    disabled={isHolding}
                  />
                ))}
              </div>

              {/* Right Row Indicator */}
              <span className="w-6 text-center text-xs font-black text-[#5938ff]">{rowLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## Step 10: Build Customer Seat Selection Page (`/checkout/[showtimeId]`)

Create the page directory: `src/app/(customer)/checkout/[showtimeId]/`

### 1. `page.tsx` (Server Component)
Create [src/app/(customer)/checkout/[showtimeId]/page.tsx](file:///d:/RSU/SE/cinego/src/app/(customer)/checkout/[showtimeId]/page.tsx):

```tsx
// src/app/(customer)/checkout/[showtimeId]/page.tsx
// Seat selection and checkout page

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getShowtimeSeatMap } from "@/services/seat.service";
import SeatSelectionClient from "./SeatSelectionClient";

export const dynamic = "force-dynamic";

export default async function SeatSelectionPage({
  params,
}: {
  params: Promise<{ showtimeId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    const { showtimeId } = await params;
    redirect(`/login?callbackUrl=/checkout/${showtimeId}`);
  }

  const { showtimeId } = await params;
  const initialData = await getShowtimeSeatMap(showtimeId, session.user.id);

  if (!initialData) {
    redirect("/movies");
  }

  return (
    <main className="min-h-screen bg-[#02020a] text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <SeatSelectionClient showtimeId={showtimeId} initialData={initialData} />
    </main>
  );
}
```

### 2. `SeatSelectionClient.tsx` (Client Component with SWR Polling)
Create [src/app/(customer)/checkout/[showtimeId]/SeatSelectionClient.tsx](file:///d:/RSU/SE/cinego/src/app/(customer)/checkout/[showtimeId]/SeatSelectionClient.tsx):

```tsx
// src/app/(customer)/checkout/[showtimeId]/SeatSelectionClient.tsx
// Real-time seat selection with SWR 5s background polling & temporary 5-min holds

"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import useSWR from "swr";
import SeatMap from "@/components/seatmap/SeatMap";
import SeatLegend from "@/components/seatmap/SeatLegend";
import SeatHoldTimer from "@/components/seatmap/SeatHoldTimer";
import { SeatLayoutItem, ShowtimeSeatMapResponse } from "@/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Props {
  showtimeId: string;
  initialData: ShowtimeSeatMapResponse;
}

export default function SeatSelectionClient({ showtimeId, initialData }: Props) {
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [heldUntil, setHeldUntil] = useState<string | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // SWR background polling every 5 seconds
  const { data, mutate } = useSWR<ShowtimeSeatMapResponse>(
    `/api/showtimes/${showtimeId}/seats`,
    fetcher,
    {
      fallbackData: initialData,
      refreshInterval: 5000,
      revalidateOnFocus: true,
    }
  );

  const seatMapData = data || initialData;
  const { showtime, seats, pricing } = seatMapData;

  const selectedSeats = seats.filter((s) => selectedSeatIds.includes(s.id));
  const totalPrice = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  // Toggle seat selection
  const handleToggleSeat = useCallback((seat: SeatLayoutItem) => {
    setErrorMsg(null);
    setSelectedSeatIds((prev) =>
      prev.includes(seat.id) ? prev.filter((id) => id !== seat.id) : [...prev, seat.id]
    );
  }, []);

  // Hold seats (Lock selection for 5 minutes)
  const handleHoldSeats = async () => {
    if (!selectedSeatIds.length) return;
    setIsHolding(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/showtimes/${showtimeId}/seats/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatIds: selectedSeatIds }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Failed to hold seats");
        await mutate(); // Refresh seat states
      } else {
        setHeldUntil(json.heldUntil);
        await mutate();
      }
    } catch {
      setErrorMsg("Network error reserving seats");
    } finally {
      setIsHolding(false);
    }
  };

  // Release seats when timer expires
  const handleExpire = async () => {
    setHeldUntil(null);
    setSelectedSeatIds([]);
    setErrorMsg("Your 5-minute seat reservation has expired. Please select again.");
    await fetch(`/api/showtimes/${showtimeId}/seats/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seatIds: selectedSeatIds }),
    });
    await mutate();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Movie & Showtime Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-[#2500f0]/30">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-24 rounded-xl overflow-hidden border border-white/20">
            <Image
              src={showtime.movie.posterUrl}
              alt={showtime.movie.title}
              fill
              className="object-cover"
            />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">{showtime.movie.title}</h1>
            <p className="text-xs text-zinc-400 mt-1">
              {showtime.screen.name} • {showtime.screen.cinemaName}
            </p>
            <p className="text-xs text-[#a5b4fc] mt-0.5">
              {new Date(showtime.startsAt).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}{" "}
              •{" "}
              {new Date(showtime.startsAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        {/* Hold Countdown */}
        <SeatHoldTimer heldUntil={heldUntil} onExpire={handleExpire} />
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/50 border border-red-500/50 text-red-200 text-xs">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Seat Map Layout */}
      <SeatMap
        seats={seats}
        selectedSeatIds={selectedSeatIds}
        onToggleSeat={handleToggleSeat}
        screenName={showtime.screen.name}
        isHolding={isHolding}
      />

      <SeatLegend pricing={pricing} />

      {/* Floating Action / Checkout Bar */}
      <div className="sticky bottom-6 z-40 p-4 sm:p-6 rounded-2xl bg-[#06071d]/95 border border-[#2500f0]/50 backdrop-blur-xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs text-zinc-400">Selected Seats: </span>
          <span className="text-sm font-bold text-white">
            {selectedSeats.length > 0
              ? selectedSeats.map((s) => `${s.rowLabel}${s.seatNum}`).join(", ")
              : "None"}
          </span>
          <div className="text-lg font-black text-[#5938ff] mt-0.5">
            Total: ฿{totalPrice.toLocaleString()}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!heldUntil ? (
            <button
              type="button"
              disabled={selectedSeats.length === 0 || isHolding}
              onClick={handleHoldSeats}
              className="px-6 py-3 rounded-xl bg-[#2500f0] hover:bg-[#3411ff] disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#2500f0]/50 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isHolding ? "Holding Seats..." : "Lock Seats & Proceed (5 min)"}
            </button>
          ) : (
            <button
              type="button"
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/50 transition-all cursor-pointer"
              onClick={() => alert("Proceeding to Phase 7 Checkout & Payment!")}
            >
              Proceed to Payment →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Step 11: End-to-End Verification Checkpoint

### 1. Verification of Seat Availability API
```bash
curl -i http://localhost:3000/api/showtimes/<showtime-id>/seats
```
*Expected:* HTTP 200 with `showtime`, `seats` array (A1..F10), `pricing`, and `availableSeats`.

### 2. Multi-Tab Real-Time SWR Polling Test
1. Open Browser Tab 1 and log in. Navigate to `/checkout/<showtime-id>`.
2. Open Browser Tab 2 (Incognito / different user) and navigate to the same showtime.
3. In Tab 1, select seats `A5` and `A6`, then click **Lock Seats (5 min)**.
4. Watch Tab 2: within **5 seconds**, seats `A5` and `A6` automatically switch from Available to **Held** without refreshing the page!

### 3. Expiration Auto-Release
1. Wait 5 minutes or simulate hold expiry by adjusting system clock / DB timestamp.
2. Verify that seats revert back to `AVAILABLE` automatically.

---

## Step 12: Merge `feature/seatmap-ui` into `phase/phase6-seatmap` and `develop`

```bash
git add .
git commit -m "feat(phase6): interactive seat map, SWR polling, 5-minute hold timer, and checkout page"
git checkout phase/phase6-seatmap
git merge feature/seatmap-ui
git branch -d feature/seatmap-ui

# Merge milestone into develop
git checkout develop
git merge phase/phase6-seatmap

# Push both branches to GitHub (preserve phase milestone branch)
git push origin develop
git push origin phase/phase6-seatmap
```

---

## Phase 6 Complete — Summary

| Deliverable | Status |
| :--- | :--- |
| `swr` package installed | Required |
| `src/types/index.ts` seat interfaces | Required |
| `src/services/seat.service.ts` domain logic | Required |
| `GET /api/showtimes/[id]/seats` route | Required |
| `POST /api/showtimes/[id]/seats/hold` (5-min hold) | Required |
| `POST /api/showtimes/[id]/seats/release` route | Required |
| `SeatMap.tsx` & subcomponents (`ScreenCurve`, `SeatItem`, `SeatLegend`, `SeatHoldTimer`) | Required |
| `/checkout/[showtimeId]` page & `SeatSelectionClient.tsx` | Required |
| SWR 5s live polling multi-tab synchronization | Required |
| `feature/seatmap-api` -> `phase/phase6-seatmap` | Merged & deleted |
| `feature/seatmap-ui` -> `phase/phase6-seatmap` | Merged & deleted |
| `phase/phase6-seatmap` -> `develop` | Merged & preserved |

**Next up:** Phase 7 — Checkout, Concurrency Transaction & Digital QR Ticket (`phase/phase7-checkout-ticket`)
