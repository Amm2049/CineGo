// POST /api/admin/movies/sync-all — admin "Sync Latest Releases" button
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { syncLatestReleases } from "@/services/movie-sync.service";

export const maxDuration = 60;

export async function POST() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  try {
    const summary = await syncLatestReleases();
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("[POST /api/admin/movies/sync-all] Error:", error);
    return NextResponse.json(
      { error: "Sync failed. Check TMDB credentials and server logs." },
      { status: 502 }
    );
  }
}
