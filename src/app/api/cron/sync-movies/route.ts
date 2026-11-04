// src/app/api/cron/sync-movies/route.ts
// Weekly catalog refresh, called by Vercel Cron (see vercel.json).
// Vercel sends "Authorization: Bearer <CRON_SECRET>" automatically when CRON_SECRET is set.

import { NextRequest, NextResponse } from "next/server";
import { syncLatestReleases } from "@/services/movie-sync.service";

export const maxDuration = 60; // seconds: 30 TMDB lookups + upserts

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  // Fail closed: if the secret is missing, nobody gets in
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncLatestReleases();
    console.log("[cron/sync-movies]", JSON.stringify(summary));
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("[cron/sync-movies] failed:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
