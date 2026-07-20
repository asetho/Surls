import { beforeEach, describe, expect, it, vi } from "vitest";

const shortLink = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn()
}));

const pageTitle = vi.hoisted(() => ({
  fetchPageTitle: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { shortLink }
}));

vi.mock("@/lib/page-title", () => pageTitle);

import { createShortLink, normalizeOptionalDate, normalizeOptionalPositiveInt, normalizeShortLinkTags } from "@/lib/links";

describe("short link creation", () => {
  beforeEach(() => {
    shortLink.create.mockReset();
    shortLink.findUnique.mockReset();
    pageTitle.fetchPageTitle.mockReset();
    shortLink.create.mockImplementation(async ({ data }) => ({ id: "link_1", ...data, tags: [] }));
  });

  it("fills a blank title from the destination page", async () => {
    pageTitle.fetchPageTitle.mockResolvedValue("Fetched Page Title");
    const assertSafeResolution = vi.fn().mockResolvedValue(true);

    const link = await createShortLink({
      destinationUrl: "https://example.com/article",
      code: "news",
      title: null
    }, undefined, { assertSafeResolution });

    expect(assertSafeResolution).toHaveBeenCalledWith("https://example.com/article");
    expect(pageTitle.fetchPageTitle).toHaveBeenCalledWith("https://example.com/article");
    expect(shortLink.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: "Fetched Page Title" }) }));
    expect(link.title).toBe("Fetched Page Title");
  });

  it("keeps manually provided titles", async () => {
    const assertSafeResolution = vi.fn().mockResolvedValue(true);

    const link = await createShortLink({
      destinationUrl: "https://example.com/article",
      code: "news",
      title: "  Manual Title  "
    }, undefined, { assertSafeResolution });

    expect(assertSafeResolution).toHaveBeenCalledWith("https://example.com/article");
    expect(pageTitle.fetchPageTitle).not.toHaveBeenCalled();
    expect(shortLink.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: "Manual Title" }) }));
    expect(link.title).toBe("Manual Title");
  });

  it("persists API token source snapshots when provided", async () => {
    const assertSafeResolution = vi.fn().mockResolvedValue(true);

    await createShortLink({
      destinationUrl: "https://example.com/article",
      code: "news",
      title: "Manual Title",
      createdByApiTokenName: "  WordPress publisher  ",
      createdByApiTokenPrefix: "  surls_abc123  "
    }, undefined, { assertSafeResolution });

    expect(shortLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdByApiTokenName: "WordPress publisher",
          createdByApiTokenPrefix: "surls_abc123"
        })
      })
    );
  });

  it("rejects destinations that resolve to private addresses before saving", async () => {
    const assertSafeResolution = vi.fn().mockRejectedValue(new Error("Destination resolves to a private or internal address."));

    await expect(
      createShortLink({
        destinationUrl: "https://private.example/article",
        code: "news",
        fetchTitle: false
      }, undefined, { assertSafeResolution })
    ).rejects.toThrow(/private or internal address/i);

    expect(shortLink.create).not.toHaveBeenCalled();
  });

  it("rejects invalid dates, max-click values, and empty tag slugs", () => {
    expect(() => normalizeOptionalDate("not a date")).toThrow(/valid expiration/i);
    expect(() => normalizeOptionalPositiveInt("0", "Max clicks")).toThrow(/positive whole number/i);
    expect(() => normalizeShortLinkTags(["!!!"])).toThrow(/letter or number/i);
  });

  it("rejects tag arrays with excessive count or aggregate input", () => {
    expect(() => normalizeShortLinkTags(Array.from({ length: 101 }, () => "tag"))).toThrow(/too many tags/i);
    expect(() => normalizeShortLinkTags(["x".repeat(8_001)])).toThrow(/too many tags/i);
  });
});
