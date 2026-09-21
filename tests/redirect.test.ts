import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import {
  analyticsOptOutReason,
  handleShortRedirect,
  isAdminReferrer,
  REDIRECT_DESTINATION_DNS_CHECK,
  shouldRecordRedirectClick
} from "@/lib/redirect";
import { linkUnavailableReason } from "@/lib/links";
import { UPLOAD_GRANT_QUERY_PARAM } from "@/lib/upload-grants";

const redirectMocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  findUnique: vi.fn(),
  getSetting: vi.fn(),
  getSiteName: vi.fn(),
  getCurrentSession: vi.fn(),
  isAdminUser: vi.fn(),
  recordClick: vi.fn(),
  publicWebrootNotFoundResponse: vi.fn(),
  publicWebrootResponse: vi.fn(),
  assertNoPrivateResolutionWithTimeout: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shortLink: {
      findUnique: redirectMocks.findUnique
    }
  }
}));

vi.mock("@/lib/settings", () => ({
  getSetting: redirectMocks.getSetting,
  getSiteName: redirectMocks.getSiteName
}));

vi.mock("@/lib/auth", () => ({
  getCurrentSession: redirectMocks.getCurrentSession,
  isAdminUser: redirectMocks.isAdminUser
}));

vi.mock("@/lib/clicks", () => ({
  recordClick: redirectMocks.recordClick
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: redirectMocks.checkRateLimit
}));

vi.mock("@/lib/webroot", () => ({
  publicWebrootNotFoundResponse: redirectMocks.publicWebrootNotFoundResponse,
  publicWebrootResponse: redirectMocks.publicWebrootResponse
}));

vi.mock("@/lib/url-safety", async () => {
  const actual = await vi.importActual<typeof import("@/lib/url-safety")>("@/lib/url-safety");
  return {
    ...actual,
    assertNoPrivateResolutionWithTimeout: redirectMocks.assertNoPrivateResolutionWithTimeout
  };
});

function requestFor(path: string, headers?: HeadersInit) {
  const request = new Request(`http://localhost:3000${path}`, { headers }) as unknown as NextRequest;
  Object.defineProperty(request, "nextUrl", { value: new URL(`http://localhost:3000${path}`) });
  return request;
}

describe("redirect behavior", () => {
  beforeEach(() => {
    redirectMocks.checkRateLimit.mockReset();
    redirectMocks.findUnique.mockReset();
    redirectMocks.getSetting.mockReset();
    redirectMocks.getSiteName.mockReset();
    redirectMocks.getCurrentSession.mockReset();
    redirectMocks.isAdminUser.mockReset();
    redirectMocks.recordClick.mockReset();
    redirectMocks.publicWebrootNotFoundResponse.mockReset();
    redirectMocks.publicWebrootResponse.mockReset();
    redirectMocks.assertNoPrivateResolutionWithTimeout.mockReset();
    redirectMocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 119, resetAt: new Date("2026-06-11T12:01:00.000Z") });
    redirectMocks.getCurrentSession.mockResolvedValue(null);
    redirectMocks.isAdminUser.mockImplementation((user: { role?: string } | null | undefined) => user?.role === "ADMIN");
    redirectMocks.getSetting.mockImplementation((key: string) => {
      if (key === "trackAdminClicks") return Promise.resolve(false);
      if (key === "preserveRedirectQuery") return Promise.resolve(false);
      return Promise.resolve(null);
    });
    redirectMocks.publicWebrootNotFoundResponse.mockResolvedValue(new Response("Not found", { status: 404 }));
    redirectMocks.publicWebrootResponse.mockResolvedValue(null);
    redirectMocks.getSiteName.mockResolvedValue("Surls");
    redirectMocks.recordClick.mockResolvedValue(true);
    redirectMocks.assertNoPrivateResolutionWithTimeout.mockResolvedValue(true);
  });

  it("does not record authenticated admin clicks by default", () => {
    expect(shouldRecordRedirectClick({ isHead: false, isAdminClick: true, trackAdminClicks: false })).toBe(false);
  });

  it("does not record admin-referrer clicks by default", () => {
    expect(
      shouldRecordRedirectClick({
        isHead: false,
        isAdminClick: false,
        isAdminReferrer: true,
        trackAdminClicks: false
      })
    ).toBe(false);
  });

  it("records admin clicks only when explicitly enabled", () => {
    expect(shouldRecordRedirectClick({ isHead: false, isAdminClick: true, trackAdminClicks: true })).toBe(true);
    expect(shouldRecordRedirectClick({ isHead: false, isAdminClick: false, isAdminReferrer: true, trackAdminClicks: true })).toBe(true);
  });

  it("records normal visitor clicks and skips HEAD probes", () => {
    expect(shouldRecordRedirectClick({ isHead: false, isAdminClick: false, trackAdminClicks: false })).toBe(true);
    expect(shouldRecordRedirectClick({ isHead: true, isAdminClick: false, trackAdminClicks: true })).toBe(false);
  });

  it("skips analytics for privacy opt-out headers", () => {
    expect(analyticsOptOutReason(new Headers({ dnt: "1" }))).toBe("dnt");
    expect(analyticsOptOutReason(new Headers({ "sec-gpc": "1" }))).toBe("gpc");
    expect(
      shouldRecordRedirectClick({
        analyticsOptOut: true,
        isHead: false,
        isAdminClick: false,
        trackAdminClicks: false
      })
    ).toBe(false);
  });

  it("handles disabled, expired, archived, and max-click links", () => {
    const base = { enabled: true, archivedAt: null, expiresAt: null, maxClicks: null, clickCount: 0 };
    expect(linkUnavailableReason(base)).toBeNull();
    expect(linkUnavailableReason({ ...base, enabled: false })).toMatch(/disabled/i);
    expect(linkUnavailableReason({ ...base, archivedAt: new Date() })).toMatch(/archived/i);
    expect(linkUnavailableReason({ ...base, expiresAt: new Date(Date.now() - 1000) })).toMatch(/expired/i);
    expect(linkUnavailableReason({ ...base, maxClicks: 3, clickCount: 3 })).toMatch(/click limit/i);
  });

  it("detects same-origin admin referrers", () => {
    expect(isAdminReferrer("https://asetho.link/admin/links", "https://asetho.link")).toBe(true);
    expect(isAdminReferrer("https://asetho.link/privacy", "https://asetho.link")).toBe(false);
    expect(isAdminReferrer("https://example.com/admin", "https://asetho.link")).toBe(false);
  });

  it("uses the public webroot 404 response for missing short links", async () => {
    redirectMocks.findUnique.mockResolvedValue(null);
    redirectMocks.publicWebrootNotFoundResponse.mockResolvedValue(
      new Response("<h1>Mounted 404</h1>", { headers: { "content-type": "text/html; charset=utf-8" }, status: 404 })
    );

    const response = await handleShortRedirect(requestFor("/what"), "what");

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("<h1>Mounted 404</h1>");
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(redirectMocks.publicWebrootNotFoundResponse).toHaveBeenCalledWith({ method: "GET" });
    expect(redirectMocks.getSetting).not.toHaveBeenCalled();
  });

  it("rejects excessive public lookups before querying short links", async () => {
    redirectMocks.checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date("2026-06-11T12:01:00.000Z")
    });

    const response = await handleShortRedirect(requestFor("/unknown"), "unknown", true);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(redirectMocks.findUnique).not.toHaveBeenCalled();
  });

  it("uses built-in unavailable HTML when no custom unavailable page exists", async () => {
    redirectMocks.findUnique.mockResolvedValue({
      id: "link_1",
      code: "abc",
      destinationUrl: "https://example.com",
      enabled: false,
      archivedAt: null,
      expiresAt: null,
      maxClicks: null,
      clickCount: 0
    });
    redirectMocks.getSiteName.mockResolvedValue("Surls");

    const response = await handleShortRedirect(requestFor("/abc"), "abc");

    expect(response.status).toBe(410);
    expect(response.headers.get("content-type")).toContain("text/html");
    await expect(response.text()).resolves.toContain("Short URL unavailable");
    expect(redirectMocks.publicWebrootResponse).toHaveBeenCalledWith(
      ["unavailable.html"],
      expect.objectContaining({
        cacheControl: "private, no-store, max-age=0",
        method: "GET",
        status: 410
      })
    );
    expect(redirectMocks.recordClick).not.toHaveBeenCalled();
  });

  it("serves a custom unavailable page from the public webroot when present", async () => {
    redirectMocks.findUnique.mockResolvedValue({
      id: "link_1",
      code: "abc",
      destinationUrl: "https://example.com",
      enabled: false,
      archivedAt: null,
      expiresAt: null,
      maxClicks: null,
      clickCount: 0
    });
    redirectMocks.publicWebrootResponse.mockResolvedValue(
      new Response("<h1>Custom unavailable</h1>", { headers: { "content-type": "text/html; charset=utf-8" }, status: 410 })
    );

    const response = await handleShortRedirect(requestFor("/abc"), "abc");

    expect(response.status).toBe(410);
    await expect(response.text()).resolves.toBe("<h1>Custom unavailable</h1>");
    expect(redirectMocks.getSiteName).not.toHaveBeenCalled();
  });

  it("omits the unavailable response body for HEAD probes", async () => {
    redirectMocks.findUnique.mockResolvedValue({
      id: "link_1",
      code: "abc",
      destinationUrl: "https://example.com",
      enabled: false,
      archivedAt: null,
      expiresAt: null,
      maxClicks: null,
      clickCount: 0
    });
    redirectMocks.getSiteName.mockResolvedValue("Surls");

    const response = await handleShortRedirect(requestFor("/abc"), "abc", true);

    expect(response.status).toBe(410);
    await expect(response.text()).resolves.toBe("");
    expect(redirectMocks.publicWebrootResponse).toHaveBeenCalledWith(
      ["unavailable.html"],
      expect.objectContaining({ method: "HEAD", status: 410 })
    );
  });

  it("redirects with no-store headers and records normal analytics", async () => {
    redirectMocks.findUnique.mockResolvedValue({
      id: "link_1",
      code: "abc",
      destinationUrl: "https://example.com",
      enabled: true,
      archivedAt: null,
      expiresAt: null,
      maxClicks: null,
      clickCount: 0
    });

    const response = await handleShortRedirect(requestFor("/abc"), "abc");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://example.com/");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(redirectMocks.assertNoPrivateResolutionWithTimeout).toHaveBeenCalledWith(
      "https://example.com",
      REDIRECT_DESTINATION_DNS_CHECK.timeoutMs
    );
    expect(redirectMocks.checkRateLimit).toHaveBeenCalledTimes(2);
    expect(redirectMocks.recordClick).toHaveBeenCalledOnce();
  });

  it("adds a short-lived exact-link grant to local upload redirects", async () => {
    redirectMocks.findUnique.mockResolvedValue({
      id: "link_1",
      code: "abc",
      destinationUrl: "http://localhost:3000/uploads/0123456789abcdef.txt",
      enabled: true,
      archivedAt: null,
      expiresAt: null,
      maxClicks: 1,
      clickCount: 0
    });

    const response = await handleShortRedirect(requestFor("/abc"), "abc");
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(302);
    expect(location.pathname).toBe("/uploads/0123456789abcdef.txt");
    expect(location.searchParams.get(UPLOAD_GRANT_QUERY_PARAM)).toBeTruthy();
    expect(redirectMocks.assertNoPrivateResolutionWithTimeout).not.toHaveBeenCalled();
    expect(redirectMocks.recordClick).toHaveBeenCalledWith(expect.objectContaining({ shortLinkId: "link_1" }));
  });

  it("checks the final query-forwarded destination before redirecting", async () => {
    redirectMocks.findUnique.mockResolvedValue({
      id: "link_1",
      code: "abc",
      destinationUrl: "https://example.com/path?source=stored",
      enabled: true,
      archivedAt: null,
      expiresAt: null,
      maxClicks: null,
      clickCount: 0
    });
    redirectMocks.getSetting.mockImplementation((key: string) => {
      if (key === "trackAdminClicks") return Promise.resolve(false);
      if (key === "preserveRedirectQuery") return Promise.resolve(true);
      return Promise.resolve(null);
    });

    const response = await handleShortRedirect(requestFor("/abc?source=request&campaign=fall"), "abc");

    expect(response.status).toBe(302);
    expect(redirectMocks.assertNoPrivateResolutionWithTimeout).toHaveBeenCalledWith(
      "https://example.com/path?source=stored&campaign=fall",
      REDIRECT_DESTINATION_DNS_CHECK.timeoutMs
    );
    expect(response.headers.get("location")).toBe("https://example.com/path?source=stored&campaign=fall");
  });

  it.each([
    { isHead: false, method: "GET" },
    { isHead: true, method: "HEAD" }
  ])("blocks an unsafe resolution before a $method redirect or click mutation", async ({ isHead }) => {
    redirectMocks.findUnique.mockResolvedValue({
      id: "link_1",
      code: "abc",
      destinationUrl: "https://rebind.example/path",
      enabled: true,
      archivedAt: null,
      expiresAt: null,
      maxClicks: 3,
      clickCount: 1
    });
    redirectMocks.assertNoPrivateResolutionWithTimeout.mockRejectedValue(
      new Error("Destination resolves to a private or internal address.")
    );
    redirectMocks.getSiteName.mockResolvedValue("Surls");

    const response = await handleShortRedirect(requestFor("/abc"), "abc", isHead);

    expect(response.status).toBe(502);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(redirectMocks.assertNoPrivateResolutionWithTimeout).toHaveBeenCalledWith(
      "https://rebind.example/path",
      REDIRECT_DESTINATION_DNS_CHECK.timeoutMs
    );
    expect(redirectMocks.checkRateLimit).toHaveBeenCalledOnce();
    expect(redirectMocks.recordClick).not.toHaveBeenCalled();
    if (isHead) await expect(response.text()).resolves.toBe("");
  });

  it("does not exempt an external upload-looking destination", async () => {
    redirectMocks.findUnique.mockResolvedValue({
      id: "link_1",
      code: "abc",
      destinationUrl: "https://files.example/uploads/report.pdf",
      enabled: true,
      archivedAt: null,
      expiresAt: null,
      maxClicks: null,
      clickCount: 0
    });
    redirectMocks.assertNoPrivateResolutionWithTimeout.mockRejectedValue(new Error("Unsafe destination."));
    redirectMocks.getSiteName.mockResolvedValue("Surls");

    const response = await handleShortRedirect(requestFor("/abc"), "abc");

    expect(response.status).toBe(502);
    expect(response.headers.get("location")).toBeNull();
    expect(redirectMocks.assertNoPrivateResolutionWithTimeout).toHaveBeenCalledWith(
      "https://files.example/uploads/report.pdf",
      REDIRECT_DESTINATION_DNS_CHECK.timeoutMs
    );
  });

  it("returns a controlled response for a malformed legacy destination with query forwarding", async () => {
    redirectMocks.findUnique.mockResolvedValue({
      id: "link_1",
      code: "abc",
      destinationUrl: "not a URL",
      enabled: true,
      archivedAt: null,
      expiresAt: null,
      maxClicks: 3,
      clickCount: 1
    });
    redirectMocks.getSetting.mockImplementation((key: string) => {
      if (key === "trackAdminClicks") return Promise.resolve(false);
      if (key === "preserveRedirectQuery") return Promise.resolve(true);
      return Promise.resolve(null);
    });

    const response = await handleShortRedirect(requestFor("/abc?campaign=fall"), "abc");

    expect(response.status).toBe(502);
    expect(response.headers.get("location")).toBeNull();
    expect(redirectMocks.assertNoPrivateResolutionWithTimeout).not.toHaveBeenCalled();
    expect(redirectMocks.checkRateLimit).toHaveBeenCalledOnce();
    expect(redirectMocks.recordClick).not.toHaveBeenCalled();
  });

  it("fails closed when a destination DNS check exceeds its deadline", async () => {
    redirectMocks.findUnique.mockResolvedValue({
      id: "link_1",
      code: "abc",
      destinationUrl: "https://slow.example",
      enabled: true,
      archivedAt: null,
      expiresAt: null,
      maxClicks: 3,
      clickCount: 1
    });
    redirectMocks.assertNoPrivateResolutionWithTimeout.mockRejectedValue(
      new Error("Destination DNS lookup timed out.")
    );

    const response = await handleShortRedirect(requestFor("/abc"), "abc");

    expect(response.status).toBe(502);
    expect(response.headers.get("location")).toBeNull();
    expect(redirectMocks.recordClick).not.toHaveBeenCalled();
    expect(redirectMocks.assertNoPrivateResolutionWithTimeout).toHaveBeenCalledWith(
      "https://slow.example",
      REDIRECT_DESTINATION_DNS_CHECK.timeoutMs
    );
  });

  it("coalesces concurrent checks for one hostname without blocking other destinations", async () => {
    let releaseSlowCheck: (() => void) | undefined;
    redirectMocks.findUnique.mockImplementation(({ where }: { where: { code: string } }) =>
      Promise.resolve({
        id: `link_${where.code}`,
        code: where.code,
        destinationUrl: where.code === "slow" ? "https://slow.example/path" : "https://safe.example/path",
        enabled: true,
        archivedAt: null,
        expiresAt: null,
        maxClicks: null,
        clickCount: 0
      })
    );
    redirectMocks.assertNoPrivateResolutionWithTimeout.mockImplementation((destinationUrl: string) => {
      if (destinationUrl.includes("slow.example")) {
        return new Promise<void>((resolve) => {
          releaseSlowCheck = resolve;
        });
      }
      return Promise.resolve(true);
    });

    const slowRequests = Array.from({ length: 8 }, () =>
      handleShortRedirect(requestFor("/slow"), "slow")
    );
    await vi.waitFor(() => {
      expect(redirectMocks.assertNoPrivateResolutionWithTimeout).toHaveBeenCalledTimes(1);
    });

    const safeResponse = await handleShortRedirect(requestFor("/safe"), "safe");

    expect(safeResponse.status).toBe(302);
    expect(safeResponse.headers.get("location")).toBe("https://safe.example/path");
    expect(redirectMocks.assertNoPrivateResolutionWithTimeout).toHaveBeenCalledTimes(2);

    releaseSlowCheck?.();
    const responses = await Promise.all(slowRequests);
    expect(responses.every((response) => response.status === 302)).toBe(true);
  });

  it("preserves the operator private-destination opt-in decision", async () => {
    redirectMocks.findUnique.mockResolvedValue({
      id: "link_1",
      code: "abc",
      destinationUrl: "http://10.0.0.5/admin",
      enabled: true,
      archivedAt: null,
      expiresAt: null,
      maxClicks: null,
      clickCount: 0
    });
    redirectMocks.assertNoPrivateResolutionWithTimeout.mockResolvedValue(true);

    const response = await handleShortRedirect(requestFor("/abc"), "abc");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://10.0.0.5/admin");
    expect(redirectMocks.assertNoPrivateResolutionWithTimeout).toHaveBeenCalledWith(
      "http://10.0.0.5/admin",
      REDIRECT_DESTINATION_DNS_CHECK.timeoutMs
    );
  });

  it("redirects but skips analytics when the visitor opts out", async () => {
    redirectMocks.findUnique.mockResolvedValue({
      id: "link_1",
      code: "abc",
      destinationUrl: "https://example.com",
      enabled: true,
      archivedAt: null,
      expiresAt: null,
      maxClicks: null,
      clickCount: 0
    });

    const response = await handleShortRedirect(requestFor("/abc", { dnt: "1" }), "abc");

    expect(response.status).toBe(302);
    expect(response.headers.get("x-shorturl-analytics")).toBe("opted-out");
    expect(redirectMocks.checkRateLimit).toHaveBeenCalledTimes(2);
    expect(redirectMocks.recordClick).toHaveBeenCalledWith(
      expect.objectContaining({
        shortLinkId: "link_1",
        storeEvent: false
      })
    );
  });

  it("redirects but skips analytics when click volume is rate limited", async () => {
    redirectMocks.findUnique.mockResolvedValue({
      id: "link_1",
      code: "abc",
      destinationUrl: "https://example.com",
      enabled: true,
      archivedAt: null,
      expiresAt: null,
      maxClicks: null,
      clickCount: 0
    });
    redirectMocks.checkRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 599, resetAt: new Date("2026-06-11T12:01:00.000Z") })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: new Date("2026-06-11T12:01:00.000Z") });

    const response = await handleShortRedirect(requestFor("/abc"), "abc");

    expect(response.status).toBe(302);
    expect(response.headers.get("x-shorturl-analytics")).toBe("rate-limited");
    expect(redirectMocks.recordClick).not.toHaveBeenCalled();
  });

  it("keeps max-click enforcement for a spoofed admin referrer", async () => {
    redirectMocks.findUnique.mockResolvedValue({
      id: "link_1",
      code: "abc",
      destinationUrl: "https://example.com",
      enabled: true,
      archivedAt: null,
      expiresAt: null,
      maxClicks: 3,
      clickCount: 1
    });

    const response = await handleShortRedirect(
      requestFor("/abc", { referer: "http://localhost:3000/admin-spoof" }),
      "abc"
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("x-shorturl-admin-click")).toBe("ignored");
    expect(redirectMocks.recordClick).toHaveBeenCalledWith(
      expect.objectContaining({
        shortLinkId: "link_1",
        storeEvent: false
      })
    );
  });

  it("keeps admin-referrer analytics suppression for links without a max-click limit", async () => {
    redirectMocks.findUnique.mockResolvedValue({
      id: "link_1",
      code: "abc",
      destinationUrl: "https://example.com",
      enabled: true,
      archivedAt: null,
      expiresAt: null,
      maxClicks: null,
      clickCount: 0
    });

    const response = await handleShortRedirect(
      requestFor("/abc", { referer: "http://localhost:3000/admin-spoof" }),
      "abc"
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("x-shorturl-admin-click")).toBe("ignored");
    expect(redirectMocks.recordClick).not.toHaveBeenCalled();
  });

  it("counts authenticated non-admin requests against finite-use links", async () => {
    redirectMocks.getCurrentSession.mockResolvedValue({ user: { role: "USER" } });
    redirectMocks.findUnique.mockResolvedValue({
      id: "link_1",
      code: "abc",
      destinationUrl: "https://example.com",
      enabled: true,
      archivedAt: null,
      expiresAt: null,
      maxClicks: 3,
      clickCount: 1
    });

    const response = await handleShortRedirect(requestFor("/abc"), "abc");

    expect(response.status).toBe(302);
    expect(response.headers.get("x-shorturl-admin-click")).toBeNull();
    expect(redirectMocks.recordClick).toHaveBeenCalledWith(
      expect.objectContaining({
        shortLinkId: "link_1",
        storeEvent: true
      })
    );
  });

  it("keeps max-click enforcement for HEAD redirects without storing a detailed event", async () => {
    redirectMocks.findUnique.mockResolvedValue({
      id: "link_1",
      code: "abc",
      destinationUrl: "https://example.com",
      enabled: true,
      archivedAt: null,
      expiresAt: null,
      maxClicks: 3,
      clickCount: 1
    });

    const response = await handleShortRedirect(requestFor("/abc"), "abc", true);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://example.com/");
    expect(response.headers.get("x-shorturl-analytics")).toBe("head");
    expect(redirectMocks.recordClick).toHaveBeenCalledWith(
      expect.objectContaining({
        shortLinkId: "link_1",
        storeEvent: false
      })
    );
  });

  it("keeps max-click enforcement when detailed analytics are rate limited", async () => {
    redirectMocks.findUnique.mockResolvedValue({
      id: "link_1",
      code: "abc",
      destinationUrl: "https://example.com",
      enabled: true,
      archivedAt: null,
      expiresAt: null,
      maxClicks: 3,
      clickCount: 1
    });
    redirectMocks.checkRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 599, resetAt: new Date("2026-06-11T12:01:00.000Z") })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: new Date("2026-06-11T12:01:00.000Z") });

    const response = await handleShortRedirect(requestFor("/abc"), "abc");

    expect(response.status).toBe(302);
    expect(response.headers.get("x-shorturl-analytics")).toBe("rate-limited");
    expect(redirectMocks.recordClick).toHaveBeenCalledWith(
      expect.objectContaining({
        shortLinkId: "link_1",
        storeEvent: false
      })
    );
  });
});
