// src/services/user.service.ts
// CineGo -- Reusable User & Genre Preferences Service Layer

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { GenrePreferenceItem } from "@/types";

/**
 * Fetch member profile details along with currently selected genre IDs.
 */
export async function getUserProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      interests: {
        select: { genreId: true },
      },
    },
  });
}

/**
 * Fetch all available genres sorted alphabetically with a boolean flag indicating if the user has selected it.
 */
export async function getGenresWithUserSelection(
  userId?: string
): Promise<GenrePreferenceItem[]> {
  const [allGenres, userInterests] = await Promise.all([
    prisma.genre.findMany({ orderBy: { name: "asc" } }),
    userId
      ? prisma.userInterest.findMany({
          where: { userId },
          select: { genreId: true },
        })
      : Promise.resolve([]),
  ]);

  const selectedSet = new Set(userInterests.map((ui) => ui.genreId));

  return allGenres.map((genre) => ({
    id: genre.id,
    name: genre.name,
    selected: selectedSet.has(genre.id),
  }));
}

/**
 * Atomically update user genre selections inside a Prisma transaction.
 */
export async function updateUserInterests(userId: string, genreIds: string[]) {
  return prisma.$transaction(async (tx) => {
    // 1. Delete previous selections
    await tx.userInterest.deleteMany({
      where: { userId },
    });

    // 2. Insert new selections
    if (genreIds.length > 0) {
      await tx.userInterest.createMany({
        data: genreIds.map((genreId: string) => ({
          userId,
          genreId,
        })),
      });
    }

    // 3. Invalidate cached recommendations so next visit generates fresh AI scores
    await tx.user.update({
      where: { id: userId },
      data: {
        recommendations: Prisma.DbNull,
        recommendationsUpdatedAt: null,
      },
    });

    return { count: genreIds.length };
  });
}

/**
 * Fetch favorite genre names for a user (used by Phase 5 AI Gemini Recommendation Engine).
 */
export async function getUserFavoriteGenres(userId: string): Promise<string[]> {
  const interests = await prisma.userInterest.findMany({
    where: { userId },
    include: { genre: true },
  });

  return interests.map((i) => i.genre.name);
}
