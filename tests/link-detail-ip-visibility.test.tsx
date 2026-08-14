import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TestUser = {
  displayTimeZone?: string | null;
  id: string;
  recentClickPageSize?: number;
  role: string;
};

const authState = vi.hoisted((): { currentUser: TestUser } => ({
  currentUser: { displayTimeZone: "America/Los_Angeles", id: "admin_1", role: "ADMIN" }
}));

const prisma = vi.hoisted(() => ({
  shortLink: {
    findFirst: vi.fn()
  }
}));

const settings = vi.hoisted(() => ({
  getSettings: vi.fn()
}));

const clicks = vi.hoisted(() => ({
  clickStats: vi.fn()
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not found");
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  useRouter: () => ({ refresh: vi.fn() })
}));

vi.mock("@/lib/auth", () => ({
  isAdminUser: (user: { role?: string } | null | undefined) => user?.role === "ADMIN",
  requireAdmin: vi.fn(async () => authState.currentUser)
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/settings", () => settings);
vi.mock("@/lib/csrf", () => ({ getCsrfToken: () => "csrf-token" }));
vi.mock("@/lib/env", () => ({ appBaseUrl: () => "http://localhost:3000" }));
vi.mock("@/lib/links", () => ({ shortUrl: (baseUrl: string, code: string) => `${baseUrl}/${code}` }));
vi.mock("@/lib/clicks", () => ({
  DEFAULT_RECENT_CLICK_PAGE_SIZE: 20,
  MAX_RECENT_CLICK_PAGE_SIZE: 500,
  clickStats: clicks.clickStats,
  normalizeRecentClickPage: (value: unknown) => Number(value) || 1,
  normalizeRecentClickPageSize: (value: unknown) => Number(value) || 20,
  resolveRecentClickPageSize: (value: unknown, savedValue: unknown = 20) =>
    value === undefined ? Number(savedValue) || 20 : Number(value) || 20
}));
vi.mock("@/app/admin/links/actions", () => ({
  archiveLinkAction: vi.fn(),
  restoreLinkAction: vi.fn()
}));
vi.mock("@/components/ConfirmButton", () => ({
  ConfirmButton: ({ children }: { children?: ReactNode }) => children ?? null
}));
vi.mock("@/components/CopyShareButtons", () => ({
  CopyShortUrlButton: () => "Copy",
  ShareButton: () => "Share"
}));
vi.mock("@/components/DeleteLinkModal", () => ({
  DeleteLinkModal: () => null
}));
vi.mock("@/components/DistributionCharts", () => ({
  BrowserDeviceCharts: () => null,
  SourcesCharts: () => null
}));
vi.mock("@/components/EditLinkModal", () => ({
  EditLinkModal: () => "Edit"
}));
vi.mock("@/components/HistoricalClicksPanel", () => ({
  HistoricalClicksPanel: () => null
}));
vi.mock("@/components/LocationCharts", () => ({
  LocationCharts: () => null
}));
vi.mock("@/components/QrCodeModal", () => ({
  QrCodeModal: () => "QR code"
}));
vi.mock("@/components/StatsTabs", () => ({
  StatsTabs: () => null
}));

function testLink() {
  return {
    archivedAt: null,
    code: "example",
    createdAt: new Date("2026-06-11T12:00:00.000Z"),
    description: null,
    destinationUrl: "https://example.com",
    enabled: true,
    expiresAt: null,
    id: "link_123",
    lastClickedAt: null,
    maxClicks: null,
    notes: null,
    tags: [],
    title: "Example"
  };
}

function testStats({ referrer = null }: { referrer?: string | null } = {}) {
  return {
    byBrowser: [],
    byDevice: [],
    countryCounts: [],
    dailyHistory: [{ count: 1, date: "2026-06-11" }],
    periodCounts: {
      allTime: 1,
      bestDay: { count: 1, date: "2026-06-11" },
      last24Hours: 1,
      last30Days: 1,
      last7Days: 1
    },
    recent: [
      {
        country: "US",
        id: "click_1",
        ipAddress: "198.51.100.10",
        occurredAt: new Date("2026-06-11T12:30:00.000Z"),
        referrer,
        userAgent: "Mozilla/5.0"
      }
    ],
    recentPagination: {
      page: 1,
      pageCount: 1,
      pageSize: 20,
      total: 1
    },
    sourceCounts: {
      direct: 1,
      referrer: 0,
      referrers: []
    },
    total: 1,
    unique: 1
  };
}

async function renderLinkDetail() {
  const { default: LinkDetailPage } = await import("@/app/admin/links/[id]/page");
  const element = await LinkDetailPage({
    params: Promise.resolve({ id: "link_123" }),
    searchParams: Promise.resolve({})
  });
  return renderToStaticMarkup(element);
}

describe("link detail raw IP visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.currentUser = { displayTimeZone: "America/Los_Angeles", id: "admin_1", role: "ADMIN" };
    prisma.shortLink.findFirst.mockResolvedValue(testLink());
    settings.getSettings.mockResolvedValue({
      displayTimeZone: "America/New_York",
      siteName: "Surls"
    });
    clicks.clickStats.mockResolvedValue(testStats());
  });

  it("formats link detail timestamps in the current user's timezone", async () => {
    authState.currentUser = { displayTimeZone: "America/Los_Angeles", id: "admin_1", role: "ADMIN" };

    const markup = await renderLinkDetail();

    expect(clicks.clickStats).toHaveBeenCalledWith("link_123", expect.any(Date), "America/Los_Angeles", {
      page: 1,
      pageSize: 20
    });
    expect(markup).toContain("06/11/26 5:00:00 AM");
    expect(markup).toContain("06/11/26 5:30:00 AM");
  });

  it("shows raw click IP addresses to admins", async () => {
    authState.currentUser = { displayTimeZone: "America/Los_Angeles", id: "admin_1", role: "ADMIN" };

    const markup = await renderLinkDetail();

    expect(markup).toContain("198.51.100.10");
    expect(markup).toContain('href="https://ip-lookup.net/?ip=198.51.100.10"');
  });

  it("shows raw click IP addresses to non-admin users", async () => {
    authState.currentUser = { displayTimeZone: "America/Los_Angeles", id: "user_1", role: "USER" };

    const markup = await renderLinkDetail();

    expect(markup).toContain("198.51.100.10");
    expect(markup).not.toContain("Hidden");
  });

  it("scopes a non-admin detail lookup to the authenticated owner", async () => {
    authState.currentUser = { displayTimeZone: "America/Los_Angeles", id: "user_1", role: "USER" };

    await renderLinkDetail();

    expect(prisma.shortLink.findFirst).toHaveBeenCalledWith({
      where: { id: "link_123", createdById: "user_1" },
      include: { tags: { include: { tag: true } } }
    });
  });

  it("does not load another user's detail analytics when the owner-scoped lookup misses", async () => {
    authState.currentUser = { displayTimeZone: "America/Los_Angeles", id: "user_1", role: "USER" };
    prisma.shortLink.findFirst.mockResolvedValue(null);

    await expect(renderLinkDetail()).rejects.toThrow("not found");

    expect(prisma.shortLink.findFirst).toHaveBeenCalledWith({
      where: { id: "link_123", createdById: "user_1" },
      include: { tags: { include: { tag: true } } }
    });
    expect(clicks.clickStats).not.toHaveBeenCalled();
  });

  it("renders the full recent-click referrer URL when the browser sends it", async () => {
    clicks.clickStats.mockResolvedValue(
      testStats({ referrer: "https://referrer.example/docs/page" })
    );

    const markup = await renderLinkDetail();

    expect(markup).toContain("[https://referrer.example/docs/page]");
    expect(markup).toContain('href="https://referrer.example/docs/page"');
  });

  it("shows link tags on the detail page", async () => {
    prisma.shortLink.findFirst.mockResolvedValue({
      ...testLink(),
      tags: [{ tag: { id: "tag_1", name: "Upload", slug: "upload" } }]
    });

    const markup = await renderLinkDetail();

    expect(markup).toContain("Tags:");
    expect(markup).toContain('href="/admin/links?tag=upload"');
    expect(markup).toContain(">Upload</a>");
  });
});
