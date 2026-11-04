-- AlterTable
ALTER TABLE "NewsletterItem" ADD COLUMN "completedAt" TIMESTAMP(3);

-- Redan klara statusar räknas från senaste uppdatering
UPDATE "NewsletterItem" SET "completedAt" = "updatedAt" WHERE "section" = 'status' AND "status" = 'klar';
