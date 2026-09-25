-- Store approximate city names supplied by a trusted proxy, without addresses or coordinates.
ALTER TABLE "Session" ADD COLUMN "city" TEXT;
