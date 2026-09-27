// src/app/api/user/interests/route.ts
// Lightweight Next.js Route Handler delegating to user.service.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getGenresWithUserSelection,
  updateUserInterests,
} from "@/services/user.service";

// GET /api/user/interests
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await getGenresWithUserSelection(session.user.id);
    return NextResponse.json({ genres: items });
  } catch (error) {
    console.error("Error fetching user genres:", error);
    return NextResponse.json(
      { error: "Failed to fetch genre preferences" },
      { status: 500 }
    );
  }
}

// POST /api/user/interests
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { genreIds } = body;

    if (!Array.isArray(genreIds)) {
      return NextResponse.json(
        { error: "genreIds must be an array of strings" },
        { status: 400 }
      );
    }

    const result = await updateUserInterests(session.user.id, genreIds);
    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("Error updating user interests:", error);
    return NextResponse.json(
      { error: "Failed to update genre preferences" },
      { status: 500 }
    );
  }
}
