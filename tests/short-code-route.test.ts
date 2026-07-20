import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, HEAD } from "@/app/s/[code]/route";

const routeMocks = vi.hoisted(() => ({ handleShortRedirect: vi.fn() }));

vi.mock("@/lib/redirect", () => ({ handleShortRedirect: routeMocks.handleShortRedirect }));

function requestFor(path: string) {
  return new Request(`http://localhost:3000${path}`) as unknown as NextRequest;
}

function paramsFor(code: string) {
  return { params: Promise.resolve({ code }) };
}

describe("/s/:code public redirect route", () => {
  beforeEach(() => {
    routeMocks.handleShortRedirect.mockReset();
    routeMocks.handleShortRedirect.mockResolvedValue(new Response(null, { status: 302 }));
  });

  it("records ordinary GET redirects as non-HEAD requests", async () => {
    await GET(requestFor("/s/offer"), paramsFor("offer"));

    expect(routeMocks.handleShortRedirect).toHaveBeenCalledWith(expect.any(Request), "offer", false);
  });

  it("marks HEAD probes so redirect accounting cannot consume the click budget", async () => {
    await HEAD(requestFor("/s/offer"), paramsFor("offer"));

    expect(routeMocks.handleShortRedirect).toHaveBeenCalledWith(expect.any(Request), "offer", true);
  });
});
