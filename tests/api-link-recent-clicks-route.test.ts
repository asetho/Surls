import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  isAdminUser: (user: { role?: string } | null | undefined) => user?.role === "ADMIN",
  requireAdmin: vi.fn()
}));

const prisma = vi.hoisted(() => ({
  shortLink: {
    findUnique: vi.fn()
  },
  user: {
    update: vi.fn()
  }
}));

const settings = vi.hoisted(() => ({
  getSettings: vi.fn()
}));

const clicks = vi.hoisted(() => ({
  recentClicksPage: vi.fn()
}));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/settings", () => settings);
vi.mock("@/lib/clicks", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/clicks")>(),
  recentClicksPage: clicks.recentClicksPage
}));

function request(query = "page=2&pageSize=10") {
  return new NextRequest(`http://localhost:3000/api/links/link_123/recent-clicks?${query}`);
}

function recentRow() {
  return {
    country: "US",
    id: "click_1",
    ipAddress: "198.51.100.10",
    occurredAt: new Date("2026-06-11T12:30:00.000Z"),
    referrer: null,
    userAgent: "Mozilla/5.0"
  };
}

describe("GET /api/links/[id]/recent-clicks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAdmin.mockResolvedValue({ id: "user_1", role: "USER", recentClickPageSize: 20 });
    prisma.shortLink.findUnique.mockResolvedValue({ id: "link_123" });
    prisma.user.update.mockResolvedValue({ id: "user_1" });
    settings.getSettings.mockResolvedValue({ displayTimeZone: "America/New_York" });
    clicks.recentClicksPage.mockResolvedValue({
      recent: [recentRow()],
      recentPagination: {
        page: 2,
        pageCount: 4,
        pageSize: 10,
        total: 31
      }
    });
  });

  it("returns formatted recent clicks with raw IP addresses for authenticated users", async () => {
    const { GET } = await import("@/app/api/links/[id]/recent-clicks/route");

    const response = await GET(request(), { params: Promise.resolve({ id: "link_123" }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { recentClickPageSize: 10 }
    });
    expect(clicks.recentClicksPage).toHaveBeenCalledWith("link_123", { page: "2", pageSize: 10 });
    expect(payload).toMatchObject({
      pagination: {
        page: 2,
        pageCount: 4,
        pageSize: 10,
        total: 31
      },
      rows: [
        {
          countryLabel: "US",
          id: "click_1",
          ipAddressLabel: "198.51.100.10",
          occurredAtLabel: "06/11/26 8:30:00 AM",
          referrerLabel: "direct",
          userAgentLabel: "Mozilla/5.0"
        }
      ],
      summary: {
        end: 11,
        start: 11,
        total: 31
      }
    });
    expect(JSON.stringify(payload)).toContain("198.51.100.10");
  });

  it("uses the saved row count when no page size is requested", async () => {
    const { GET } = await import("@/app/api/links/[id]/recent-clicks/route");
    auth.requireAdmin.mockResolvedValue({ id: "user_1", role: "USER", recentClickPageSize: 30 });

    const response = await GET(request("page=1"), { params: Promise.resolve({ id: "link_123" }) });

    expect(response.status).toBe(200);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(clicks.recentClicksPage).toHaveBeenCalledWith("link_123", { page: "1", pageSize: 30 });
  });

  it("requires an authenticated user", async () => {
    const { GET } = await import("@/app/api/links/[id]/recent-clicks/route");
    auth.requireAdmin.mockResolvedValue(null);

    const response = await GET(request(), { params: Promise.resolve({ id: "link_123" }) });

    expect(response.status).toBe(401);
    expect(prisma.shortLink.findUnique).not.toHaveBeenCalled();
  });

  it("returns not found for missing links", async () => {
    const { GET } = await import("@/app/api/links/[id]/recent-clicks/route");
    prisma.shortLink.findUnique.mockResolvedValue(null);

    const response = await GET(request(), { params: Promise.resolve({ id: "missing" }) });

    expect(response.status).toBe(404);
    expect(clicks.recentClicksPage).not.toHaveBeenCalled();
  });
});
