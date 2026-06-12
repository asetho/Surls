import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, HEAD } from "@/app/[code]/route";

const routeMocks = vi.hoisted(() => ({
  handleShortRedirect: vi.fn(),
  isBlockedPublicWebrootPath: vi.fn(),
  publicWebrootNotFoundResponse: vi.fn(),
  publicWebrootResponse: vi.fn()
}));

vi.mock("@/lib/redirect", () => ({
  handleShortRedirect: routeMocks.handleShortRedirect
}));

vi.mock("@/lib/webroot", () => ({
  isBlockedPublicWebrootPath: routeMocks.isBlockedPublicWebrootPath,
  publicWebrootNotFoundResponse: routeMocks.publicWebrootNotFoundResponse,
  publicWebrootResponse: routeMocks.publicWebrootResponse
}));

function requestFor(path: string) {
  return new Request(`http://localhost:3000${path}`) as unknown as NextRequest;
}

function paramsFor(code: string) {
  return { params: Promise.resolve({ code }) };
}

describe("single-segment public route", () => {
  beforeEach(() => {
    routeMocks.handleShortRedirect.mockReset();
    routeMocks.isBlockedPublicWebrootPath.mockReset();
    routeMocks.publicWebrootNotFoundResponse.mockReset();
    routeMocks.publicWebrootResponse.mockReset();

    routeMocks.handleShortRedirect.mockResolvedValue(new Response("short link", { status: 302 }));
    routeMocks.isBlockedPublicWebrootPath.mockReturnValue(false);
    routeMocks.publicWebrootNotFoundResponse.mockResolvedValue(new Response("not found", { status: 404 }));
    routeMocks.publicWebrootResponse.mockResolvedValue(null);
  });

  it("serves public webroot files before short-link redirects", async () => {
    routeMocks.publicWebrootResponse.mockResolvedValue(new Response("file", { status: 200 }));

    const response = await GET(requestFor("/test.html"), paramsFor("test.html"));

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("file");
    expect(routeMocks.isBlockedPublicWebrootPath).not.toHaveBeenCalled();
    expect(routeMocks.handleShortRedirect).not.toHaveBeenCalled();
  });

  it("returns the webroot 404 for blocked public paths instead of checking short links", async () => {
    routeMocks.isBlockedPublicWebrootPath.mockReturnValue(true);

    const response = await GET(requestFor("/login.html"), paramsFor("login.html"));

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("not found");
    expect(routeMocks.publicWebrootNotFoundResponse).toHaveBeenCalledWith({ method: "GET" });
    expect(routeMocks.handleShortRedirect).not.toHaveBeenCalled();
  });

  it("uses an empty webroot 404 response for blocked HEAD requests", async () => {
    routeMocks.isBlockedPublicWebrootPath.mockReturnValue(true);
    routeMocks.publicWebrootNotFoundResponse.mockResolvedValue(new Response(null, { status: 404 }));

    const response = await HEAD(requestFor("/login.html"), paramsFor("login.html"));

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("");
    expect(routeMocks.publicWebrootNotFoundResponse).toHaveBeenCalledWith({ method: "HEAD" });
    expect(routeMocks.handleShortRedirect).not.toHaveBeenCalled();
  });
});
