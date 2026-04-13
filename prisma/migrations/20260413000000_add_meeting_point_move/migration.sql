-- AlterTable
ALTER TABLE "MeetingPoint" ADD COLUMN "movedToMeetingId" INTEGER;
ALTER TABLE "MeetingPoint" ADD COLUMN "movedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "MeetingPoint" ADD CONSTRAINT "MeetingPoint_movedToMeetingId_fkey" FOREIGN KEY ("movedToMeetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
