import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  isAdminUser: (user: { role?: string } | null | undefined) => user?.role === "ADMIN",
  requireAdmin: vi.fn()
}));

const prisma = vi.hoisted(() => ({
  shortLink: {
    findFirst: vi.fn(),
    findUnique: vi.fn()
  }
}));

const env = vi.hoisted(() => ({ appBaseUrl: vi.fn(() => "https://surls.example") }));
const links = vi.hoisted(() => ({ shortUrl: vi.fn((baseUrl: string, code: string) => `${baseUrl}/${code}`) }));
const qr = vi.hoisted(() => ({
  generateQrEps: vi.fn(() => "eps"),
  generateQrPng: vi.fn(async () => new Uint8Array([1])),
  generateQrSvg: vi.fn(async () => "svg"),
  normalizeQrErrorCorrectionLevel: vi.fn(() => "M"),
  normalizeQrFormat: vi.fn(() => "png"),
  normalizeQrSize: vi.fn(() => 300)
}));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/env", () => env);
vi.mock("@/lib/links", () => links);
vi.mock("@/lib/qr", () => qr);

function request() {
  return new NextRequest("http://localhost:3000/api/links/link_123/qr/png");
}

describe("GET /api/links/[id]/qr/[format]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAdmin.mockResolvedValue({ id: "user_1", role: "USER" });
  });

  it("returns a QR asset for a USER-owned link", async () => {
    prisma.shortLink.findFirst.mockResolvedValue({ code: "owned-link" });
    const { GET } = await import("@/app/api/links/[id]/qr/[format]/route");

    const response = await GET(request(), { params: Promise.resolve({ id: "link_123", format: "png" }) });

    expect(response.status).toBe(200);
    expect(prisma.shortLink.findFirst).toHaveBeenCalledWith({
      where: { id: "link_123", createdById: "user_1" },
      select: { code: true }
    });
    expect(prisma.shortLink.findUnique).not.toHaveBeenCalled();
  });

  it("does not disclose a foreign link to a USER", async () => {
    prisma.shortLink.findFirst.mockResolvedValue(null);
    const { GET } = await import("@/app/api/links/[id]/qr/[format]/route");

    const response = await GET(request(), { params: Promise.resolve({ id: "victim_link", format: "png" }) });

    expect(response.status).toBe(404);
    expect(prisma.shortLink.findFirst).toHaveBeenCalledWith({
      where: { id: "victim_link", createdById: "user_1" },
      select: { code: true }
    });
    expect(qr.generateQrPng).not.toHaveBeenCalled();
  });

  it("preserves site-administrator access to any link id", async () => {
    auth.requireAdmin.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
    prisma.shortLink.findUnique.mockResolvedValue({ code: "other-users-link" });
    const { GET } = await import("@/app/api/links/[id]/qr/[format]/route");

    const response = await GET(request(), { params: Promise.resolve({ id: "victim_link", format: "png" }) });

    expect(response.status).toBe(200);
    expect(prisma.shortLink.findUnique).toHaveBeenCalledWith({
      where: { id: "victim_link" },
      select: { code: true }
    });
    expect(prisma.shortLink.findFirst).not.toHaveBeenCalled();
  });
});
