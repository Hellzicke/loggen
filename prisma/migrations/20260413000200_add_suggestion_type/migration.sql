-- AlterTable
ALTER TABLE "Suggestion" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'förslag';
ALTER TABLE "Suggestion" ADD COLUMN "system" TEXT;
ALTER TABLE "Suggestion" ADD COLUMN "fixedInVersion" TEXT;
