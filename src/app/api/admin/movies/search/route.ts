// GET /api/admin/movies/search?q=dune — server-side TMDB search (keeps the token off the browser)
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { searchTmdbForAdmin } from "@/services/movie-sync.service";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  if (q.length > 100) return NextResponse.json({ error: "Query too long" }, { status: 400 });

  try {
    const results = await searchTmdbForAdmin(q);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[GET /api/admin/movies/search] Error:", error);
    return NextResponse.json({ error: "TMDB search failed" }, { status: 502 });
  }
}
