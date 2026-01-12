-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Meeting" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MeetingPoint" ADD COLUMN "completed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MeetingPoint" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "MeetingPoint" ADD COLUMN "notes" TEXT DEFAULT '';

