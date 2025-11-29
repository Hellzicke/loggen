-- CreateTable
CREATE TABLE "ReadSignature" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "logId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReadSignature_logId_name_key" ON "ReadSignature"("logId", "name");

-- AddForeignKey
ALTER TABLE "ReadSignature" ADD CONSTRAINT "ReadSignature_logId_fkey" FOREIGN KEY ("logId") REFERENCES "LogMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

