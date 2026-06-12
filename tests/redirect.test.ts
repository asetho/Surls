import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { handleShortRedirect, isAdminReferrer, shouldRecordRedirectClick } from "@/lib/redirect";
import { linkUnavailableReason } from "@/lib/links";

const redirectMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  getSetting: vi.fn(),
  getSiteName: vi.fn(),
  publicWebrootNotFoundResponse: vi.fn()
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

vi.mock("@/lib/webroot", () => ({
  publicWebrootNotFoundResponse: redirectMocks.publicWebrootNotFoundResponse
}));

function requestFor(path: string) {
  return new Request(`http://localhost:3000${path}`) as unknown as NextRequest;
}

describe("redirect behavior", () => {
  beforeEach(() => {
    redirectMocks.findUnique.mockReset();
    redirectMocks.getSetting.mockReset();
    redirectMocks.getSiteName.mockReset();
    redirectMocks.publicWebrootNotFoundResponse.mockReset();
    redirectMocks.publicWebrootNotFoundResponse.mockResolvedValue(new Response("Not found", { status: 404 }));
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
});
