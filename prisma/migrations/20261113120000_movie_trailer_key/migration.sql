-- Trailer on the movie page: YouTube video id from TMDB videos (null = no trailer)
ALTER TABLE "Movie" ADD COLUMN "trailerKey" TEXT;
