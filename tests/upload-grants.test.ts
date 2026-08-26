import { beforeEach, describe, expect, it, vi } from "vitest";

const shortLink = vi.hoisted(() => ({
  findUnique: vi.fn()
}));

const uploadedFileRecords = vi.hoisted(() => ({
  ensureUploadedFileRecord: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { shortLink }
}));
vi.mock("@/lib/uploaded-file-records", () => uploadedFileRecords);

import {
  grantUploadDownloadUrl,
  hasValidUploadDownloadGrant,
  UPLOAD_GRANT_QUERY_PARAM,
  UPLOAD_GRANT_TTL_MS
} from "@/lib/upload-grants";

describe("upload download grants", () => {
  const now = new Date("2026-08-26T06:00:00.000Z");
  const destinationUrl = "http://localhost:3000/uploads/0123456789abcdef.txt";

  beforeEach(() => {
    shortLink.findUnique.mockReset();
    shortLink.findUnique.mockResolvedValue({
      archivedAt: null,
      clickCount: 1,
      createdById: "user_123",
      destinationUrl,
      enabled: true,
      expiresAt: null,
      maxClicks: 1
    });
    uploadedFileRecords.ensureUploadedFileRecord.mockReset();
    uploadedFileRecords.ensureUploadedFileRecord.mockResolvedValue({
      downloadName: "Report.txt",
      ownerId: "user_123",
      shortLinkId: "link_123"
    });
  });

  it("authorizes the final permitted download after its click has been counted", async () => {
    const grantedUrl = grantUploadDownloadUrl(destinationUrl, "link_123", "GET", now);

    await expect(
      hasValidUploadDownloadGrant(
        new Request(grantedUrl),
        "0123456789abcdef.txt",
        "GET",
        new Date(now.getTime() + 1_000)
      )
    ).resolves.toBe(true);
    expect(new URL(grantedUrl).searchParams.get(UPLOAD_GRANT_QUERY_PARAM)).toBeTruthy();
    expect(shortLink.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "link_123" } }));
  });

  it("rejects direct, expired, wrong-method, and wrong-file requests", async () => {
    await expect(
      hasValidUploadDownloadGrant(new Request(destinationUrl), "0123456789abcdef.txt", "GET", now)
    ).resolves.toBe(false);
    const grantedUrl = grantUploadDownloadUrl(destinationUrl, "link_123", "GET", now);

    await expect(
      hasValidUploadDownloadGrant(new Request(grantedUrl), "other.txt", "GET", new Date(now.getTime() + 1_000))
    ).resolves.toBe(false);
    await expect(
      hasValidUploadDownloadGrant(new Request(grantedUrl), "0123456789abcdef.txt", "HEAD", new Date(now.getTime() + 1_000))
    ).resolves.toBe(false);
    await expect(
      hasValidUploadDownloadGrant(
        new Request(grantedUrl),
        "0123456789abcdef.txt",
        "GET",
        new Date(now.getTime() + UPLOAD_GRANT_TTL_MS + 1)
      )
    ).resolves.toBe(false);
  });

  it("revokes grants when the exact link is disabled, archived, expired, or over its limit", async () => {
    const grantedUrl = grantUploadDownloadUrl(destinationUrl, "link_123", "GET", now);
    const request = () => new Request(grantedUrl);
    const check = () => hasValidUploadDownloadGrant(
      request(),
      "0123456789abcdef.txt",
      "GET",
      new Date(now.getTime() + 1_000)
    );

    shortLink.findUnique.mockResolvedValueOnce({
      archivedAt: null, clickCount: 0, createdById: "user_123", destinationUrl, enabled: false, expiresAt: null, maxClicks: null
    });
    await expect(check()).resolves.toBe(false);
    shortLink.findUnique.mockResolvedValueOnce({
      archivedAt: now, clickCount: 0, createdById: "user_123", destinationUrl, enabled: true, expiresAt: null, maxClicks: null
    });
    await expect(check()).resolves.toBe(false);
    shortLink.findUnique.mockResolvedValueOnce({
      archivedAt: null, clickCount: 0, createdById: "user_123", destinationUrl, enabled: true, expiresAt: now, maxClicks: null
    });
    await expect(check()).resolves.toBe(false);
    shortLink.findUnique.mockResolvedValueOnce({
      archivedAt: null, clickCount: 2, createdById: "user_123", destinationUrl, enabled: true, expiresAt: null, maxClicks: 1
    });
    await expect(check()).resolves.toBe(false);
  });

  it("does not let a new link reset the primary upload link's lifecycle", async () => {
    const grantedUrl = grantUploadDownloadUrl(destinationUrl, "link_123", "GET", now);
    shortLink.findUnique.mockResolvedValue({
      archivedAt: null,
      clickCount: 0,
      createdById: "attacker_456",
      destinationUrl,
      enabled: true,
      expiresAt: null,
      maxClicks: null
    });
    uploadedFileRecords.ensureUploadedFileRecord.mockResolvedValue({
      downloadName: "Report.txt",
      ownerId: "user_123",
      shortLinkId: "original_link"
    });

    await expect(hasValidUploadDownloadGrant(
      new Request(grantedUrl),
      "0123456789abcdef.txt",
      "GET",
      new Date(now.getTime() + 1_000)
    )).resolves.toBe(false);
  });

  it("keeps the primary upload link valid after its user is deleted", async () => {
    const grantedUrl = grantUploadDownloadUrl(destinationUrl, "link_123", "GET", now);
    shortLink.findUnique.mockResolvedValue({
      archivedAt: null,
      clickCount: 0,
      createdById: null,
      destinationUrl,
      enabled: true,
      expiresAt: null,
      maxClicks: null
    });
    uploadedFileRecords.ensureUploadedFileRecord.mockResolvedValue({
      downloadName: "Report.txt",
      ownerId: null,
      shortLinkId: "link_123"
    });

    await expect(hasValidUploadDownloadGrant(
      new Request(grantedUrl),
      "0123456789abcdef.txt",
      "GET",
      new Date(now.getTime() + 1_000)
    )).resolves.toBe(true);
  });

  it("does not add grants to external destinations", () => {
    expect(grantUploadDownloadUrl("https://example.test/report.pdf", "link_123", "GET", now))
      .toBe("https://example.test/report.pdf");
  });
});
