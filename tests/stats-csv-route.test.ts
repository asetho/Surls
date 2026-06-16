import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  isAdminUser: (user: { role?: string } | null | undefined) => user?.role === "ADMIN",
  requireAdmin: vi.fn()
}));

const prisma = vi.hoisted(() => ({
  clickEvent: {
    findMany: vi.fn()
  }
}));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/prisma", () => ({ prisma }));

function request() {
  return new NextRequest("http://localhost:3000/api/links/link_123/stats.csv");
}

function clickRow() {
  return {
    browser: "Chrome",
    country: "US",
    device: "Desktop",
    id: "click_1",
    ipAddress: "198.51.100.10",
    occurredAt: new Date("2026-06-11T12:00:00.000Z"),
    referrer: "https://referrer.example",
    region: "PA",
    userAgent: "Mozilla/5.0"
  };
}

describe("stats CSV raw IP visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.clickEvent.findMany.mockResolvedValueOnce([clickRow()]).mockResolvedValueOnce([]);
  });

  it("includes raw IP addresses for admins", async () => {
    const { GET } = await import("@/app/api/links/[id]/stats.csv/route");
    auth.requireAdmin.mockResolvedValue({ id: "admin_1", role: "ADMIN" });

    const response = await GET(request(), { params: Promise.resolve({ id: "link_123" }) });

    await expect(response.text()).resolves.toContain("198.51.100.10");
  });

  it("hides raw IP addresses for non-admin users", async () => {
    const { GET } = await import("@/app/api/links/[id]/stats.csv/route");
    auth.requireAdmin.mockResolvedValue({ id: "user_1", role: "USER" });

    const response = await GET(request(), { params: Promise.resolve({ id: "link_123" }) });
    const text = await response.text();

    expect(text).toContain("Hidden");
    expect(text).not.toContain("198.51.100.10");
  });
});
