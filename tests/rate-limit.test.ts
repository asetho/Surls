import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  $queryRaw: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma
}));

import { checkRateLimit, clearRateLimitBuckets, rateLimitBucketCount } from "@/lib/rate-limit";

describe("rate limiting", () => {
  beforeEach(() => {
    prisma.$executeRaw.mockReset();
    prisma.$queryRaw.mockReset();
    vi.useRealTimers();
  });

  it("uses the shared bucket count returned by Postgres", async () => {
    const resetAt = new Date("2026-06-11T16:00:00.000Z");
    prisma.$queryRaw.mockResolvedValueOnce([{ count: 3, resetAt }]);

    await expect(checkRateLimit("login:unknown:test@example.com", 4, 60_000, new Date("2026-06-11T15:59:00.000Z"))).resolves.toEqual({
      allowed: true,
      remaining: 1,
      resetAt
    });
  });

  it("blocks when the shared bucket exceeds the limit", async () => {
    const resetAt = new Date("2026-06-11T16:00:00.000Z");
    prisma.$queryRaw.mockResolvedValueOnce([{ count: 5, resetAt }]);

    await expect(checkRateLimit("login:unknown:test@example.com", 4, 60_000, new Date("2026-06-11T15:59:00.000Z"))).resolves.toEqual({
      allowed: false,
      remaining: 0,
      resetAt
    });
  });

  it("periodically prunes expired database buckets", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ count: 1, resetAt: new Date("2026-06-11T16:02:00.000Z") }]);

    await checkRateLimit("login:unknown:test@example.com", 4, 60_000, new Date("2026-06-11T16:01:00.000Z"));

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("clears and counts database buckets for tests and maintenance", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ count: 7 }]);

    await clearRateLimitBuckets();
    await expect(rateLimitBucketCount()).resolves.toBe(7);

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
