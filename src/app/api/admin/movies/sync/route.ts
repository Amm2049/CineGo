// POST /api/admin/movies/sync — import or refresh one TMDB title. Body: { tmdbId: number }
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { syncMovieByTmdbId } from "@/services/movie-sync.service";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => ({}));
  const tmdbId = Number(body?.tmdbId);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return NextResponse.json({ error: "tmdbId must be a positive integer" }, { status: 400 });
  }

  try {
    const result = await syncMovieByTmdbId(tmdbId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[POST /api/admin/movies/sync] Error:", error);
    return NextResponse.json({ error: "Import failed. Check the TMDB id." }, { status: 502 });
  }
}
