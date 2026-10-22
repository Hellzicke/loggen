-- CreateTable
CREATE TABLE "NewsletterSignature" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSignature_itemId_name_key" ON "NewsletterSignature"("itemId", "name");
CREATE INDEX "NewsletterSignature_itemId_idx" ON "NewsletterSignature"("itemId");

-- AddForeignKey
ALTER TABLE "NewsletterSignature" ADD CONSTRAINT "NewsletterSignature_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "NewsletterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
