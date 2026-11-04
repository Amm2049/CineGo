// PATCH /api/admin/movies/[id] — edit title/description, or activate/deactivate
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { updateAdminMovie, type AdminMovieUpdate } from "@/services/admin.service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const data: AdminMovieUpdate = {};

  // Copy only known fields: anything else in the body (tmdbId, duration, ...) is ignored
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 200) {
      return NextResponse.json({ error: "Title must be 1–200 characters" }, { status: 400 });
    }
    data.title = body.title.trim();
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.length > 5000) {
      return NextResponse.json(
        { error: "Description must be at most 5000 characters" },
        { status: 400 }
      );
    }
    data.description = body.description.trim();
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "isActive must be true or false" }, { status: 400 });
    }
    data.isActive = body.isActive;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const movie = await updateAdminMovie(id, data);
    if (!movie) return NextResponse.json({ error: "Movie not found" }, { status: 404 });
    return NextResponse.json({ success: true, movie });
  } catch (error) {
    console.error("[PATCH /api/admin/movies/[id]] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
