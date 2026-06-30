-- Add creation-time API token metadata for short links created through API tokens.
ALTER TABLE "ShortLink" ADD COLUMN "createdByApiTokenName" TEXT;
ALTER TABLE "ShortLink" ADD COLUMN "createdByApiTokenPrefix" TEXT;
