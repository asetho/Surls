import { beforeEach, describe, expect, it, vi } from "vitest";

const rateLimit = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const request = vi.hoisted(() => ({ requestIp: vi.fn(), requestIpHash: vi.fn() }));

vi.mock("@/lib/rate-limit", () => rateLimit);
vi.mock("@/lib/request", () => request);

import {
  checkPublicLinkLookupRate,
  PUBLIC_LINK_GLOBAL_FALLBACK_LIMIT,
  PUBLIC_LINK_LOOKUP_RATE_LIMIT
} from "@/lib/public-link-lookup";

describe("public link lookup rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true });
    request.requestIpHash.mockReturnValue("ip-hash");
  });

  it("uses the tighter per-client bucket only with a trusted client address", async () => {
    request.requestIp.mockReturnValue("198.51.100.10");

    await checkPublicLinkLookupRate({} as never);

    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith(
      "public-link-lookup:ip-hash",
      PUBLIC_LINK_LOOKUP_RATE_LIMIT.limit,
      PUBLIC_LINK_LOOKUP_RATE_LIMIT.windowMs
    );
  });

  it("uses a high global safety valve when no trusted client address exists", async () => {
    request.requestIp.mockReturnValue("unknown");

    await checkPublicLinkLookupRate({} as never);

    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith(
      "public-link-lookup:global",
      PUBLIC_LINK_GLOBAL_FALLBACK_LIMIT,
      PUBLIC_LINK_LOOKUP_RATE_LIMIT.windowMs
    );
    expect(request.requestIpHash).not.toHaveBeenCalled();
  });
});
