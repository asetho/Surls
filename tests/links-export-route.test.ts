import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  isAdminUser: (user: { role?: string } | null | undefined) => user?.role === "ADMIN",
  requireAdmin: vi.fn()
}));

const prisma = vi.hoisted(() => ({
  shortLink: {
    findMany: vi.fn()
  }
}));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/csv", () => ({ csvLine: vi.fn() }));
vi.mock("@/lib/env", () => ({ appBaseUrl: vi.fn() }));
vi.mock("@/lib/links", () => ({ shortUrl: vi.fn() }));

function request(format = "json") {
  return new NextRequest(`http://localhost:3000/api/links/export?format=${format}`);
}

describe("GET /api/links/export JSON authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a non-admin before querying the global JSON export", async () => {
    const { GET } = await import("@/app/api/links/export/route");
    auth.requireAdmin.mockResolvedValue({ id: "user_1", role: "USER" });

    const response = await GET(request());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
    expect(prisma.shortLink.findMany).not.toHaveBeenCalled();
  });

  it("allows a site administrator to export JSON", async () => {
    const { GET } = await import("@/app/api/links/export/route");
    auth.requireAdmin.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
    prisma.shortLink.findMany.mockResolvedValue([{ id: "link_1" }]);

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ links: [{ id: "link_1" }], truncated: false });
    expect(prisma.shortLink.findMany).toHaveBeenCalledWith({
      where: { archivedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5001
    });
  });

  it("limits a non-admin CSV export to links they created", async () => {
    const { GET } = await import("@/app/api/links/export/route");
    auth.requireAdmin.mockResolvedValue({ id: "user_1", role: "USER" });
    prisma.shortLink.findMany.mockResolvedValue([]);

    const response = await GET(request("csv"));
    await response.text();

    expect(response.status).toBe(200);
    expect(prisma.shortLink.findMany).toHaveBeenCalledWith({
      where: { archivedAt: null, createdById: "user_1" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 500
    });
  });
});
