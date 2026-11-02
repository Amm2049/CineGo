-- Screens become numbered theatres ("Theatre 1") with the projection format in its own column.

-- AlterTable: add columns as nullable so existing rows can be backfilled
ALTER TABLE "Screen" ADD COLUMN "number" INTEGER,
ADD COLUMN "format" TEXT;

-- Backfill: the old name was the format; number theatres per cinema in a fixed format order
UPDATE "Screen" SET "format" = "name";

UPDATE "Screen" s
SET "number" = ranked.rn
FROM (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "cinemaId"
           ORDER BY CASE "name"
             WHEN 'IMAX Laser' THEN 1
             WHEN 'Dolby Cinema' THEN 2
             WHEN '4DX Motion' THEN 3
             WHEN 'Standard' THEN 4
             ELSE 5
           END, "name", "id"
         ) AS rn
  FROM "Screen"
) ranked
WHERE s."id" = ranked."id";

UPDATE "Screen" SET "name" = 'Theatre ' || "number";

-- Enforce the new columns
ALTER TABLE "Screen" ALTER COLUMN "number" SET NOT NULL,
ALTER COLUMN "format" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Screen_cinemaId_number_key" ON "Screen"("cinemaId", "number");
