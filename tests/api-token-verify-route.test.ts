import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiTokens = vi.hoisted(() => ({
  API_TOKEN_SCOPE_LINKS_CREATE: "links:create",
  authenticateApiToken: vi.fn()
}));

vi.mock("@/lib/api-tokens", () => apiTokens);

describe("GET /api/tokens/verify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("confirms a token with link creation scope without returning token details", async () => {
    const { GET } = await import("@/app/api/tokens/verify/route");
    apiTokens.authenticateApiToken.mockResolvedValue({ id: "token_123" });

    const response = await GET(new NextRequest("https://links.example.com/api/tokens/verify", {
      headers: { authorization: "Bearer surls_valid" }
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(apiTokens.authenticateApiToken).toHaveBeenCalledWith("Bearer surls_valid", "links:create");
  });

  it("rejects missing, invalid, or insufficiently scoped tokens", async () => {
    const { GET } = await import("@/app/api/tokens/verify/route");
    apiTokens.authenticateApiToken.mockResolvedValue(null);

    for (const authorization of [undefined, "Bearer surls_invalid"]) {
      const response = await GET(new NextRequest("https://links.example.com/api/tokens/verify", {
        headers: authorization ? { authorization } : {}
      }));
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    }
  });
});
