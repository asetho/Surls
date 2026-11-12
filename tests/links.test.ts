import { beforeEach, describe, expect, it, vi } from "vitest";

const shortLink = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn()
}));

const pageTitle = vi.hoisted(() => ({
  fetchPageTitle: vi.fn()
}));

const rateLimit = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const uploadedFileRecords = vi.hoisted(() => ({ withExistingUploadedFileReference: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { shortLink }
}));

vi.mock("@/lib/page-title", () => pageTitle);
vi.mock("@/lib/rate-limit", () => rateLimit);
vi.mock("@/lib/uploaded-file-records", () => uploadedFileRecords);

import { createShortLink, normalizeOptionalDate, normalizeOptionalPositiveInt, normalizeShortLinkTags, normalizeShortLinkTextFields } from "@/lib/links";

describe("short link creation", () => {
  beforeEach(() => {
    shortLink.create.mockReset();
    shortLink.findUnique.mockReset();
    pageTitle.fetchPageTitle.mockReset();
    rateLimit.checkRateLimit.mockReset();
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true });
    uploadedFileRecords.withExistingUploadedFileReference.mockReset();
    uploadedFileRecords.withExistingUploadedFileReference.mockImplementation((_storageKey, operation) => operation({ shortLink }));
    shortLink.create.mockImplementation(async ({ data }) => ({ id: "link_1", ...data, tags: [] }));
  });

  it("checks a copied local upload while holding the reference lock", async () => {
    await createShortLink({
      destinationUrl: "http://localhost:3000/uploads/%72eport.pdf?download=1",
      code: "copy",
      fetchTitle: false
    }, undefined, { allowPrivateDestination: true, assertSafeResolution: vi.fn() });

    expect(uploadedFileRecords.withExistingUploadedFileReference).toHaveBeenCalledWith(
      "report.pdf", expect.any(Function), undefined
    );
    expect(shortLink.create).toHaveBeenCalledOnce();
  });

  it("uses the upload reservation to create a new file link before promotion", async () => {
    await createShortLink({
      destinationUrl: "http://localhost:3000/uploads/new.pdf",
      code: "new",
      fetchTitle: false
    }, { shortLink } as unknown as Parameters<typeof createShortLink>[1], {
      allowPrivateDestination: true,
      assertSafeResolution: vi.fn(),
      pendingUploadReservation: true
    });

    expect(uploadedFileRecords.withExistingUploadedFileReference).not.toHaveBeenCalled();
    expect(shortLink.create).toHaveBeenCalledOnce();
  });

  it("does not permit a pending upload outside a reservation transaction", async () => {
    await expect(createShortLink({
      destinationUrl: "http://localhost:3000/uploads/new.pdf",
      fetchTitle: false
    }, undefined, {
      allowPrivateDestination: true,
      pendingUploadReservation: true
    })).rejects.toThrow(/reservation transaction/i);

    expect(shortLink.create).not.toHaveBeenCalled();
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
      createdByApiTokenPrefix: "  demo-prefix  "
    }, undefined, { assertSafeResolution });

    expect(shortLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdByApiTokenName: "WordPress publisher",
          createdByApiTokenPrefix: "demo-prefix"
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

  it("rejects oversized shared-domain fields", async () => {
    expect(() => normalizeShortLinkTextFields({ title: "x".repeat(241) })).toThrow(/240 characters or fewer/i);
    await expect(createShortLink({
      destinationUrl: `https://example.com/${"x".repeat(4_100)}`,
      fetchTitle: false
    })).rejects.toThrow(/4096 characters or fewer/i);
  });

  it("rejects destinations that exceed the limit after URL serialization", async () => {
    const assertSafeResolution = vi.fn();
    const destinationUrl = `https://example.com/${"é".repeat(680)}`;

    await expect(createShortLink({
      destinationUrl,
      fetchTitle: false
    }, undefined, { assertSafeResolution })).rejects.toThrow(/4096 characters or fewer/i);
    expect(assertSafeResolution).not.toHaveBeenCalled();
    expect(shortLink.create).not.toHaveBeenCalled();
  });

  it("skips automatic title fetching when the user budget is exhausted", async () => {
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: false });
    const assertSafeResolution = vi.fn().mockResolvedValue(true);

    await createShortLink({
      destinationUrl: "https://example.com/article",
      code: "news",
      createdById: "user-1"
    }, undefined, { assertSafeResolution });

    expect(pageTitle.fetchPageTitle).not.toHaveBeenCalled();
    expect(shortLink.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: null }) }));
  });
});
