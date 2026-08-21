-- Store only coarse proxy-provided location metadata for session management.
ALTER TABLE "Session"
ADD COLUMN "country" TEXT,
ADD COLUMN "region" TEXT;
