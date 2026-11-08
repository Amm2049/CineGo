// src/tests/integration/recommendations.test.ts
// Match badges need something to personalise from (Phase 10): a brand-new customer with no favourite
// genres and no bookings gets no scores (and no Gemini call); picking a genre turns them on.
// Gemini is switched off here, so scores come from the genre-overlap heuristic.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gemini", () => ({ geminiClient: null, GEMINI_MODEL: "test" }));

import prisma from "@/lib/prisma";
import { getMovieRecommendationsMap } from "@/services/recommendation.service";

let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `recs-${Date.now()}@test.cinego.local`,
      passwordHash: "not-a-real-hash",
      name: "Recommendations Test",
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.userInterest.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
});

describe("AI match badges for a new customer", () => {
  it("are hidden until there is a favourite genre or a booking", async () => {
    expect(await getMovieRecommendationsMap(userId)).toEqual({});
    // Nothing was computed or cached in the background either
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.recommendationsUpdatedAt).toBeNull();
  });

  it("appear once the customer picks a favourite genre", async () => {
    const genre = await prisma.genre.findFirstOrThrow({ where: { movies: { some: { movie: { isActive: true } } } } });
    await prisma.userInterest.create({ data: { userId, genreId: genre.id } });

    const map = await getMovieRecommendationsMap(userId);
    expect(Object.keys(map).length).toBeGreaterThan(0);
    expect(Object.values(map).some((r) => r.matchScore > 70)).toBe(true); // a genre match beats the flat score
  });
});
