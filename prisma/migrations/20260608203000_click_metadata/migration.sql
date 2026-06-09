-- AlterTable
ALTER TABLE "ClickEvent" ADD COLUMN "ipAddress" TEXT;

-- CreateIndex
CREATE INDEX "ClickEvent_country_idx" ON "ClickEvent"("country");
