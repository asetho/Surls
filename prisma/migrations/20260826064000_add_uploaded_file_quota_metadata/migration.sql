CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "downloadName" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "ownerId" TEXT,
    "shortLinkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UploadedFile_storageKey_key" ON "UploadedFile"("storageKey");
CREATE UNIQUE INDEX "UploadedFile_shortLinkId_key" ON "UploadedFile"("shortLinkId");
CREATE INDEX "UploadedFile_ownerId_idx" ON "UploadedFile"("ownerId");

ALTER TABLE "UploadedFile"
ADD CONSTRAINT "UploadedFile_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UploadedFile"
ADD CONSTRAINT "UploadedFile_shortLinkId_fkey"
FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
