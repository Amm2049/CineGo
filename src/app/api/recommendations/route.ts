// src/app/api/recommendations/route.ts
// Lightweight GET Route Handler returning AI match recommendations for authenticated users

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMovieRecommendations } from "@/services/recommendation.service";

// GET /api/recommendations
export async function GET() {
  const session = await getServerSession(authOptions);

  // If user is not authenticated, return empty recommendations without throwing
  if (!session?.user?.id) {
    return NextResponse.json({
      authenticated: false,
      recommendations: [],
      message: "Sign in and select favorite genres to receive personalized AI recommendations.",
    });
  }

  try {
    const recommendations = await getMovieRecommendations(session.user.id);

    return NextResponse.json({
      authenticated: true,
      count: recommendations.length,
      recommendations,
    });
  } catch (error) {
    console.error("[API] Error fetching recommendations:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
