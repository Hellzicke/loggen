-- CreateTable
CREATE TABLE "LogAttachment" (
    "id" SERIAL NOT NULL,
    "logId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogAttachment_logId_idx" ON "LogAttachment"("logId");

-- AddForeignKey
ALTER TABLE "LogAttachment" ADD CONSTRAINT "LogAttachment_logId_fkey" FOREIGN KEY ("logId") REFERENCES "LogMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;




