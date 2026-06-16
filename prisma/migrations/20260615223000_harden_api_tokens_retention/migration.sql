ALTER TABLE "ApiToken" ADD COLUMN "scopes" TEXT NOT NULL DEFAULT 'links:create';
ALTER TABLE "ApiToken" ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "ApiToken_expiresAt_idx" ON "ApiToken"("expiresAt");
