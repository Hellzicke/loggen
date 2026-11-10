-- CreateTable
CREATE TABLE "NewsletterUpdate" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterUpdateSignature" (
    "id" SERIAL NOT NULL,
    "updateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterUpdateSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsletterUpdate_itemId_idx" ON "NewsletterUpdate"("itemId");
CREATE UNIQUE INDEX "NewsletterUpdateSignature_updateId_name_key" ON "NewsletterUpdateSignature"("updateId", "name");
CREATE INDEX "NewsletterUpdateSignature_updateId_idx" ON "NewsletterUpdateSignature"("updateId");

-- AddForeignKey
ALTER TABLE "NewsletterUpdate" ADD CONSTRAINT "NewsletterUpdate_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "NewsletterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NewsletterUpdateSignature" ADD CONSTRAINT "NewsletterUpdateSignature_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "NewsletterUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
