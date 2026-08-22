import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  publicWebrootResponse: vi.fn()
}));

vi.mock("@/lib/webroot", () => ({
  publicWebrootResponse: routeMocks.publicWebrootResponse
}));

import { GET, HEAD } from "@/app/route";

describe("root route", () => {
  beforeEach(() => {
    routeMocks.publicWebrootResponse.mockReset();
    routeMocks.publicWebrootResponse.mockResolvedValue(null);
  });

  it("keeps a mounted public homepage as the first choice", async () => {
    const mountedHomepage = new Response("mounted homepage", { status: 200 });
    routeMocks.publicWebrootResponse.mockResolvedValue(mountedHomepage);

    await expect(GET()).resolves.toBe(mountedHomepage);
    expect(routeMocks.publicWebrootResponse).toHaveBeenCalledWith([]);
  });

  it("serves the built-in Surls homepage when no mounted index exists", async () => {
    const response = await GET();
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(html).toContain("Short links that stay under your control.");
    expect(html).toContain('href="/admin"');
    expect(html).toContain('href="/brand/surls-app-icon-80.png"');
    expect(html).toContain('href="/brand/surls-app-icon-180.png"');
    expect(html).toContain('src="/brand/surls-app-icon-80.png"');
    expect(html).not.toContain('<img src="/brand/surls-app-icon-1024.png"');
    expect(html).toContain('aria-label="Color theme"');
    expect(html).toContain('data-theme-option="light"');
    expect(html).toContain('data-theme-option="dark"');
    expect(html).toContain('const storageKey = "surls-home-theme"');
    expect(html).toContain("--logo-navy: #005b83");
    expect(html).toContain("--logo-teal: #0090a8");
    expect(html).toContain("--logo-ice: #b4d8ee");
    expect(html).toContain("--button-background: var(--logo-blue)");
    expect(html).toContain("lucide-icon");
    expect(html).not.toContain('class="feature-icon" aria-hidden="true">URL</span>');
  });

  it("serves matching headers without a body for HEAD requests", async () => {
    const getResponse = await GET();
    const headResponse = await HEAD();

    expect(headResponse.status).toBe(200);
    expect(headResponse.headers.get("content-length")).toBe(getResponse.headers.get("content-length"));
    expect(headResponse.headers.get("content-type")).toBe("text/html; charset=utf-8");
    await expect(headResponse.text()).resolves.toBe("");
    expect(routeMocks.publicWebrootResponse).toHaveBeenCalledWith([], { method: "HEAD" });
  });
});
