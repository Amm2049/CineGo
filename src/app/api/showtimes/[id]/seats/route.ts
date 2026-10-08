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
