import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { analyticsOptOutReason, handleShortRedirect, isAdminReferrer, shouldRecordRedirectClick } from "@/lib/redirect";
import { linkUnavailableReason } from "@/lib/links";

const redirectMocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  findUnique: vi.fn(),
  getSetting: vi.fn(),
  getSiteName: vi.fn(),
  getCurrentSession: vi.fn(),
  recordClick: vi.fn(),
  publicWebrootNotFoundResponse: vi.fn(),
  publicWebrootResponse: vi.fn()
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
  getCurrentSession: redirectMocks.getCurrentSession
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
    redirectMocks.recordClick.mockReset();
    redirectMocks.publicWebrootNotFoundResponse.mockReset();
    redirectMocks.publicWebrootResponse.mockReset();
    redirectMocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 119, resetAt: new Date("2026-06-11T12:01:00.000Z") });
    redirectMocks.getCurrentSession.mockResolvedValue(null);
    redirectMocks.getSetting.mockImplementation((key: string) => {
      if (key === "trackAdminClicks") return Promise.resolve(false);
      if (key === "preserveRedirectQuery") return Promise.resolve(false);
      return Promise.resolve(null);
    });
    redirectMocks.publicWebrootNotFoundResponse.mockResolvedValue(new Response("Not found", { status: 404 }));
    redirectMocks.publicWebrootResponse.mockResolvedValue(null);
    redirectMocks.recordClick.mockResolvedValue(true);
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
    expect(redirectMocks.checkRateLimit).toHaveBeenCalledOnce();
    expect(redirectMocks.recordClick).toHaveBeenCalledOnce();
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
    expect(redirectMocks.checkRateLimit).toHaveBeenCalledOnce();
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
    redirectMocks.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: new Date("2026-06-11T12:01:00.000Z") });

    const response = await handleShortRedirect(requestFor("/abc"), "abc");

    expect(response.status).toBe(302);
    expect(response.headers.get("x-shorturl-analytics")).toBe("rate-limited");
    expect(redirectMocks.recordClick).not.toHaveBeenCalled();
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
    redirectMocks.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: new Date("2026-06-11T12:01:00.000Z") });

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
