import http from "node:http";
import { describe, expect, it, vi } from "vitest";
import { extractHtmlTitle, fetchPageTitle, fetchWithPinnedAddress } from "@/lib/page-title";

describe("page title fetching", () => {
  it("extracts and normalizes HTML titles", () => {
    expect(extractHtmlTitle("<html><head><title> Example &amp; Co.\n Page </title></head></html>")).toBe(
      "Example & Co. Page"
    );
  });

  it("returns null when a response is not HTML", async () => {
    const cancelled = vi.fn();
    const fetchImpl = vi.fn(async () => new Response(new ReadableStream({ cancel: cancelled }), {
      headers: { "content-type": "application/json" }
    }));

    await expect(
      fetchPageTitle("https://example.com/data", {
        resolveSafeAddress: async () => ({ address: "203.0.113.10", family: 4 }),
        fetchImpl
      })
    ).resolves.toBeNull();
    expect(cancelled).toHaveBeenCalledOnce();
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
        resolveSafeAddress: async () => ({ address: "203.0.113.10", family: 4 }),
        fetchImpl
      })
    ).resolves.toBe("Final Page");
    expect(fetchImpl).toHaveBeenLastCalledWith("https://example.com/final", expect.any(Object));
  });

  it("aborts a stalled HTML response body when the title deadline expires", async () => {
    const fetchImpl = vi.fn(async (_input: string | URL, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener(
            "abort",
            () => controller.error(new DOMException("The operation was aborted.", "AbortError")),
            { once: true }
          );
        }
      });
      return new Response(body, { headers: { "content-type": "text/html" } });
    });

    await expect(
      fetchPageTitle("https://example.com/stalled", {
        resolveSafeAddress: async () => ({ address: "203.0.113.10", family: 4 }),
        fetchImpl,
        timeoutMs: 20
      })
    ).resolves.toBeNull();
  });

  it("pins the request to the address validated for the hostname", async () => {
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<!doctype html><title>Pinned Title</title>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP listener");

    try {
      await expect(
        fetchPageTitle(`http://rebound.example:${address.port}/`, {
          resolveSafeAddress: async () => ({ address: "127.0.0.1", family: 4 })
        })
      ).resolves.toBe("Pinned Title");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it("returns bodyless HEAD responses without constructing an invalid response body", async () => {
    const server = http.createServer((_request, response) => {
      response.writeHead(204);
      response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP listener");

    try {
      await expect(
        fetchWithPinnedAddress(`http://head.example:${address.port}/`, {
          method: "HEAD",
          resolvedAddress: { address: "127.0.0.1", family: 4 }
        })
      ).resolves.toMatchObject({ body: null, status: 204 });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });
});
