-- AlterTable
ALTER TABLE "LogMessage" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LogMessage" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "LogMessage" ADD COLUMN "unpinnedAt" TIMESTAMP(3);

