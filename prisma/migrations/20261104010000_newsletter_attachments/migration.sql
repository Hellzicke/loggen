-- AlterTable
ALTER TABLE "NewsletterItem" ADD COLUMN "attachments" JSONB NOT NULL DEFAULT '[]';
