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
