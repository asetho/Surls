import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  shortLink: {
    findFirst: vi.fn()
  }
}));

vi.mock("@/app/bookmarklet/actions", () => ({ createBookmarkletLinkAction: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  isAdminUser: (user: { role?: string }) => user.role === "ADMIN",
  requireAdmin: vi.fn(async () => ({ id: "user_1", email: "admin@example.test", name: "Admin", role: "USER" }))
}));
vi.mock("@/lib/csrf", () => ({ getCsrfToken: () => "csrf-token" }));
vi.mock("@/lib/dashboard-theme", () => ({ dashboardThemeCssVariables: () => ({}) }));
vi.mock("@/lib/env", () => ({ appBaseUrl: () => "https://sho.rt" }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/settings", () => ({
  getSettings: vi.fn(async () => ({ dashboardTheme: {}, favicons: null, siteName: "Surls" }))
}));
vi.mock("@/lib/turnstile", () => ({ turnstileSiteKey: () => null }));

describe("bookmarklet created-link summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.shortLink.findFirst.mockResolvedValue({
      code: "hetrixtools",
      destinationUrl: "https://hetrixtools.com",
      id: "link_1",
      title: "HetrixTools"
    });
  });

  it("shows title, the full copyable short URL, and destination in that order", async () => {
    const { default: BookmarkletPage } = await import("@/app/bookmarklet/page");
    const page = await BookmarkletPage({ searchParams: Promise.resolve({ created: "link_1" }) });
    const markup = renderToStaticMarkup(page);

    const titlePosition = markup.indexOf("<dt>Title</dt>");
    const shortUrlPosition = markup.indexOf("<dt>Short URL</dt>");
    const destinationPosition = markup.indexOf("<dt>Destination</dt>");

    expect(titlePosition).toBeGreaterThan(-1);
    expect(shortUrlPosition).toBeGreaterThan(titlePosition);
    expect(destinationPosition).toBeGreaterThan(shortUrlPosition);
    expect(markup).toContain('href="https://sho.rt/hetrixtools"');
    expect(markup).toContain(">https://sho.rt/hetrixtools</span>");
    expect(markup).toContain(">Copy</span>");
    expect(prisma.shortLink.findFirst).toHaveBeenCalledWith({
      where: { id: "link_1", createdById: "user_1" }
    });
  });
});
