import { describe, expect, it, vi } from "vitest";
import { extractHtmlTitle, fetchPageTitle } from "@/lib/page-title";

describe("page title fetching", () => {
  it("extracts and normalizes HTML titles", () => {
    expect(extractHtmlTitle("<html><head><title> Example &amp; Co.\n Page </title></head></html>")).toBe(
      "Example & Co. Page"
    );
  });

  it("returns null when a response is not HTML", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } }));

    await expect(
      fetchPageTitle("https://example.com/data", {
        assertSafeResolution: async () => true,
        fetchImpl
      })
    ).resolves.toBeNull();
  });

  it("follows safe redirects and reads the destination title", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/final" } }))
      .mockResolvedValueOnce(
        new Response("<!doctype html><title>Final Page</title>", { headers: { "content-type": "text/html" } })
      );

    await expect(
      fetchPageTitle("https://example.com/start", {
        assertSafeResolution: async () => true,
        fetchImpl
      })
    ).resolves.toBe("Final Page");
    expect(fetchImpl).toHaveBeenLastCalledWith("https://example.com/final", expect.any(Object));
  });
});
