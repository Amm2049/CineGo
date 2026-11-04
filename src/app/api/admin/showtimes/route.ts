// POST /api/admin/showtimes — body: { movieId, screenId, startsAt (ISO string) }
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { createShowtime } from "@/services/showtime.service";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => ({}));
  const { movieId, screenId, startsAt } = body ?? {};
  if (typeof movieId !== "string" || typeof screenId !== "string" || typeof startsAt !== "string") {
    return NextResponse.json({ error: "movieId, screenId and startsAt are required" }, { status: 400 });
  }

  try {
    const result = await createShowtime({ movieId, screenId, startsAt: new Date(startsAt) });
    if (!result.success) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/showtimes] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
