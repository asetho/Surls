import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "./rate-limit";
import { requestIp, requestIpHash } from "./request";

export const PUBLIC_LINK_LOOKUP_RATE_LIMIT = {
  limit: 600,
  windowMs: 60 * 1000
} as const;
export const PUBLIC_LINK_GLOBAL_FALLBACK_LIMIT = 30_000;

export function checkPublicLinkLookupRate(request: NextRequest) {
  const hasTrustedClientIp = requestIp(request) !== "unknown";
  return checkRateLimit(
    hasTrustedClientIp ? `public-link-lookup:${requestIpHash(request)}` : "public-link-lookup:global",
    hasTrustedClientIp ? PUBLIC_LINK_LOOKUP_RATE_LIMIT.limit : PUBLIC_LINK_GLOBAL_FALLBACK_LIMIT,
    PUBLIC_LINK_LOOKUP_RATE_LIMIT.windowMs
  );
}

export function publicLinkLookupRateLimitResponse(isHead = false) {
  return new NextResponse(isHead ? null : "Too many requests.", {
    status: 429,
    headers: {
      "cache-control": "private, no-store, max-age=0",
      "content-type": "text/plain; charset=utf-8",
      "retry-after": String(PUBLIC_LINK_LOOKUP_RATE_LIMIT.windowMs / 1000)
    }
  });
}
