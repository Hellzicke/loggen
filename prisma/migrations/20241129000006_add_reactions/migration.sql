-- CreateTable
CREATE TABLE "Reaction" (
    "id" SERIAL NOT NULL,
    "emoji" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_logId_name_emoji_key" ON "Reaction"("logId", "name", "emoji");

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_logId_fkey" FOREIGN KEY ("logId") REFERENCES "LogMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

