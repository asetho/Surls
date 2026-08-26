import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const lookup = vi.hoisted(() => ({
  checkPublicLinkLookupRate: vi.fn(),
  publicLinkLookupRateLimitResponse: vi.fn(() => new Response("Too many requests.", { status: 429 }))
}));
const prisma = vi.hoisted(() => ({ shortLink: { findUnique: vi.fn() } }));
const qr = vi.hoisted(() => ({
  generateQrAssetBody: vi.fn(),
  normalizeQrErrorCorrectionLevel: vi.fn(() => "M"),
  normalizeQrFormat: vi.fn(() => "png"),
  normalizeQrSize: vi.fn(() => 300),
  QR_CONTENT_TYPES: { png: "image/png" },
  qrAssetFilename: vi.fn(() => "link.png")
}));

vi.mock("@/lib/public-link-lookup", () => lookup);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/qr", () => qr);
vi.mock("@/lib/env", () => ({ appBaseUrl: () => "https://sho.rt" }));
vi.mock("@/lib/links", () => ({ shortUrl: vi.fn() }));

describe("public QR lookup throttling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects excessive lookups before querying for a code", async () => {
    const { GET } = await import("@/app/[code]/qr/[format]/route");
    lookup.checkPublicLinkLookupRate.mockResolvedValue({ allowed: false });
    const request = new NextRequest("http://localhost:3000/private-code/qr/png");

    const response = await GET(request, { params: Promise.resolve({ code: "private-code", format: "png" }) });

    expect(response.status).toBe(429);
    expect(prisma.shortLink.findUnique).not.toHaveBeenCalled();
    expect(qr.generateQrAssetBody).not.toHaveBeenCalled();
  });
});
