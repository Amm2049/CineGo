-- One ticket (QR) per booked seat instead of one per booking.

-- A booking may now have many tickets
DROP INDEX "Ticket_bookingId_key";

-- Add the seat link as nullable first, so existing tickets can be converted
ALTER TABLE "Ticket" ADD COLUMN "bookingSeatId" TEXT;

-- Existing ticket keeps the booking's first seat (by row, then seat number)
UPDATE "Ticket" t
SET "bookingSeatId" = (
  SELECT bs."id"
  FROM "BookingSeat" bs
  JOIN "Seat" s ON s."id" = bs."seatId"
  WHERE bs."bookingId" = t."bookingId"
  ORDER BY s."rowLabel", s."seatNum"
  LIMIT 1
);

-- Every other seat of that booking gets its own new ticket and QR.
-- It copies the old ticket's state: an old ticket that was scanned admitted the whole booking.
WITH extra AS (
  SELECT t."bookingId", bs."id" AS "bookingSeatId", gen_random_uuid()::text AS code,
         t."status", t."issuedAt", t."usedAt", t."scannedById"
  FROM "Ticket" t
  JOIN "BookingSeat" bs ON bs."bookingId" = t."bookingId"
  WHERE bs."id" <> t."bookingSeatId"
)
INSERT INTO "Ticket" ("id", "bookingId", "bookingSeatId", "ticketCode", "qrPayload", "status", "issuedAt", "usedAt", "scannedById")
SELECT gen_random_uuid()::text, "bookingId", "bookingSeatId", code, 'CINEGO:' || code, "status", "issuedAt", "usedAt", "scannedById"
FROM extra;

-- Fails loudly if a ticket's booking has no seats (should never happen for a paid booking)
ALTER TABLE "Ticket" ALTER COLUMN "bookingSeatId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_bookingSeatId_key" ON "Ticket"("bookingSeatId");

-- CreateIndex
CREATE INDEX "Ticket_bookingId_idx" ON "Ticket"("bookingId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_bookingSeatId_fkey" FOREIGN KEY ("bookingSeatId") REFERENCES "BookingSeat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
