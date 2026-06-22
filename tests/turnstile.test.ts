import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

async function loadTurnstile(siteKey = "", secretKey = "") {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    AUTH_SECRET: "test-secret-that-is-long-enough-for-surls",
    NODE_ENV: "test",
    TURNSTILE_SECRET_KEY: secretKey,
    TURNSTILE_SITE_KEY: siteKey
  };
  return import("@/lib/turnstile");
}

function request() {
  return new NextRequest("http://localhost:3000/api/auth/login", { method: "POST" });
}

describe("turnstile verification", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("skips verification when Turnstile is not configured", async () => {
    const turnstile = await loadTurnstile();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(turnstile.verifyTurnstileChallenge(new FormData(), request())).resolves.toEqual({
      ok: true,
      skipped: true
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects configured verification without a response token", async () => {
    const turnstile = await loadTurnstile("site-key", "secret-key");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(turnstile.verifyTurnstileChallenge(new FormData(), request())).resolves.toEqual({
      ok: false,
      reason: "missing"
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts response tokens to Cloudflare Siteverify", async () => {
    const turnstile = await loadTurnstile("site-key", "secret-key");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        headers: { "content-type": "application/json" },
        status: 200
      })
    );
    const formData = new FormData();
    formData.set("cf-turnstile-response", "response-token");

    await expect(turnstile.verifyTurnstileChallenge(formData, request())).resolves.toEqual({
      ok: true,
      skipped: false
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        body: expect.any(URLSearchParams),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST"
      })
    );
    const body = fetchSpy.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get("secret")).toBe("secret-key");
    expect(body.get("response")).toBe("response-token");
  });
});
