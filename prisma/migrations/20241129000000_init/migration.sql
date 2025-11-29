-- CreateTable
CREATE TABLE "LogMessage" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogMessage_pkey" PRIMARY KEY ("id")
);

