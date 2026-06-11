import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const RATE_LIMIT_PRUNE_INTERVAL_MS = 60 * 1000;
let lastPruneAt = 0;

function asCount(value: number | bigint | undefined) {
  return typeof value === "bigint" ? Number(value) : value ?? 0;
}

async function pruneExpiredBuckets(now: Date) {
  if (now.getTime() - lastPruneAt < RATE_LIMIT_PRUNE_INTERVAL_MS) return;
  lastPruneAt = now.getTime();
  await prisma.$executeRaw(Prisma.sql`DELETE FROM "RateLimitBucket" WHERE "resetAt" <= ${now}`);
}

export async function checkRateLimit(key: string, limit: number, windowMs: number, now = new Date()) {
  if (!key.trim()) throw new Error("Rate limit key is required.");
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Rate limit must be a positive whole number.");
  if (!Number.isSafeInteger(windowMs) || windowMs < 1) throw new Error("Rate limit window must be a positive whole number.");

  await pruneExpiredBuckets(now);
  const resetAt = new Date(now.getTime() + windowMs);
  const rows = await prisma.$queryRaw<Array<{ count: number | bigint; resetAt: Date }>>(Prisma.sql`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, ${resetAt}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${resetAt}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count", "resetAt"
  `);
  const bucket = rows[0];
  const count = asCount(bucket?.count);
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: bucket?.resetAt ?? resetAt
  };
}

export async function clearRateLimitBuckets() {
  lastPruneAt = 0;
  await prisma.$executeRaw(Prisma.sql`DELETE FROM "RateLimitBucket"`);
}

export async function rateLimitBucketCount() {
  const rows = await prisma.$queryRaw<Array<{ count: number | bigint }>>(Prisma.sql`
    SELECT COUNT(*)::int AS count FROM "RateLimitBucket"
  `);
  return asCount(rows[0]?.count);
}
