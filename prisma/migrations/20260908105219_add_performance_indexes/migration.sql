-- CreateIndex
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");

-- CreateIndex
CREATE INDEX "Showtime_movieId_startsAt_idx" ON "Showtime"("movieId", "startsAt");
