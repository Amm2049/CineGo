-- Accounts created with "Continue with Google" have no password
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
