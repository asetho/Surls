import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiTokens = vi.hoisted(() => ({
  API_TOKEN_SCOPE_LINKS_CREATE: "links:create",
  authenticateApiToken: vi.fn()
}));

const auth = vi.hoisted(() => ({
  requireAdmin: vi.fn()
}));

const rateLimit = vi.hoisted(() => ({
  checkRateLimit: vi.fn()
}));

const links = vi.hoisted(() => ({
  createShortLink: vi.fn(),
  shortUrl: (baseUrl: string, code: string) => `${baseUrl.replace(/\/$/, "")}/${code}`
}));

const audit = vi.hoisted(() => ({
  auditLog: vi.fn()
}));

vi.mock("@/lib/api-tokens", () => apiTokens);
vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/rate-limit", () => rateLimit);
vi.mock("@/lib/links", () => links);
vi.mock("@/lib/audit", () => audit);

function jsonRequest(body: unknown, authorization?: string) {
  return new NextRequest("http://localhost:3000/api/links", {
    body: JSON.stringify(body),
    headers: {
      ...(authorization ? { authorization } : {}),
      "content-type": "application/json"
    },
    method: "POST"
  });
}

describe("POST /api/links token hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true, count: 1, resetAt: new Date("2026-06-11T12:01:00.000Z") });
    links.createShortLink.mockResolvedValue({
      code: "example",
      id: "link_123",
      title: "Example"
    });
  });

  it("rejects expired or otherwise invalid bearer tokens when no session user exists", async () => {
    const { POST } = await import("@/app/api/links/route");
    apiTokens.authenticateApiToken.mockResolvedValue(null);
    auth.requireAdmin.mockResolvedValue(null);

    const response = await POST(jsonRequest({ destinationUrl: "https://example.com" }, "Bearer surls_expired"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(apiTokens.authenticateApiToken).toHaveBeenCalledWith("Bearer surls_expired", "links:create");
    expect(links.createShortLink).not.toHaveBeenCalled();
  });

  it("rejects bearer tokens that do not satisfy the create-link scope", async () => {
    const { POST } = await import("@/app/api/links/route");
    apiTokens.authenticateApiToken.mockResolvedValue(null);
    auth.requireAdmin.mockResolvedValue(null);

    const response = await POST(jsonRequest({ destinationUrl: "https://example.com" }, "Bearer surls_readonly"));

    expect(response.status).toBe(401);
    expect(apiTokens.authenticateApiToken).toHaveBeenCalledWith("Bearer surls_readonly", "links:create");
    expect(links.createShortLink).not.toHaveBeenCalled();
  });

  it("creates links with a valid scoped API token", async () => {
    const { POST } = await import("@/app/api/links/route");
    apiTokens.authenticateApiToken.mockResolvedValue({
      name: "WordPress publisher",
      tokenPrefix: "surls_abc123",
      user: { id: "user_api", role: "ADMIN" }
    });

    const response = await POST(
      jsonRequest({ code: "example", destinationUrl: "https://example.com", title: "Example" }, "Bearer surls_valid")
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      code: "example",
      id: "link_123",
      shortUrl: "http://localhost:3000/example",
      title: "Example"
    });
    expect(auth.requireAdmin).not.toHaveBeenCalled();
    expect(links.createShortLink).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "example",
        createdByApiTokenName: "WordPress publisher",
        createdByApiTokenPrefix: "surls_abc123",
        createdById: "user_api",
        destinationUrl: "https://example.com",
        title: "Example"
      })
    );
    expect(audit.auditLog).toHaveBeenCalledWith(expect.objectContaining({ details: { code: "example", via: "api" } }));
  });

  it("keeps session-authenticated API creation working without a bearer token", async () => {
    const { POST } = await import("@/app/api/links/route");
    apiTokens.authenticateApiToken.mockResolvedValue(null);
    auth.requireAdmin.mockResolvedValue({ id: "user_session", role: "ADMIN" });

    const response = await POST(jsonRequest({ destinationUrl: "https://example.com" }));

    expect(response.status).toBe(201);
    expect(apiTokens.authenticateApiToken).toHaveBeenCalledWith(null, "links:create");
    expect(links.createShortLink).toHaveBeenCalledWith(
      expect.objectContaining({
        createdById: "user_session",
        createdByApiTokenName: undefined,
        createdByApiTokenPrefix: undefined,
        destinationUrl: "https://example.com"
      })
    );
    expect(audit.auditLog).toHaveBeenCalledWith(expect.objectContaining({ details: { code: "example", via: "session" } }));
  });
});
