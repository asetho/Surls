type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  bucket.count += 1;
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt
  };
}

export function clearRateLimitBuckets() {
  buckets.clear();
}
