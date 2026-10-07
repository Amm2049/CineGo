-- AlterTable
ALTER TABLE "User" ADD COLUMN     "recommendations" JSONB,
ADD COLUMN     "recommendationsUpdatedAt" TIMESTAMP(3);
