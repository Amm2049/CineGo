-- Migration: add_movie_tmdbid
-- Adds tmdbId (nullable, unique) to Movie for TMDB import deduplication

-- AlterTable
ALTER TABLE "Movie" ADD COLUMN "tmdbId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Movie_tmdbId_key" ON "Movie"("tmdbId");
