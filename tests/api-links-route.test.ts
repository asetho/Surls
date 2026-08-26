import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiTokens = vi.hoisted(() => ({
  API_TOKEN_SCOPE_LINKS_CREATE: "links:create",
  authenticateApiToken: vi.fn()
}));

const auth = vi.hoisted(() => ({
  requireAdmin: vi.fn()
}));

const csrf = vi.hoisted(() => ({
  validateCsrfValue: vi.fn()
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
vi.mock("@/lib/csrf", () => csrf);
vi.mock("@/lib/rate-limit", () => rateLimit);
vi.mock("@/lib/links", () => links);
vi.mock("@/lib/audit", () => audit);

function jsonRequest(body: unknown, authorization?: string, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/links", {
    body: JSON.stringify(body),
    headers: {
      ...(authorization !== undefined ? { authorization } : {}),
      "content-type": "application/json",
      ...headers
    },
    method: "POST"
  });
}

describe("POST /api/links token hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    csrf.validateCsrfValue.mockImplementation((value: string) => {
      if (value !== "csrf-token") throw new Error("Invalid CSRF token.");
    });
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

    const response = await POST(
      jsonRequest(
        { destinationUrl: "https://example.com" },
        undefined,
        { origin: "http://localhost:3000", "X-Surls-CSRF": "csrf-token" }
      )
    );

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

  it("rejects session creation without a valid CSRF header", async () => {
    const { POST } = await import("@/app/api/links/route");
    apiTokens.authenticateApiToken.mockResolvedValue(null);
    auth.requireAdmin.mockResolvedValue({ id: "user_session", role: "USER" });

    const response = await POST(jsonRequest({ destinationUrl: "https://example.com" }));

    expect(response.status).toBe(403);
    expect(rateLimit.checkRateLimit).not.toHaveBeenCalled();
    expect(links.createShortLink).not.toHaveBeenCalled();
  });

  it("does not fall back to a session when a supplied bearer credential is invalid", async () => {
    const { POST } = await import("@/app/api/links/route");
    apiTokens.authenticateApiToken.mockResolvedValue(null);
    auth.requireAdmin.mockResolvedValue({ id: "user_session", role: "USER" });

    const response = await POST(jsonRequest(
      { destinationUrl: "https://example.com" },
      "Bearer surls_invalid",
      { origin: "http://localhost:3000", "X-Surls-CSRF": "csrf-token" }
    ));

    expect(response.status).toBe(401);
    expect(auth.requireAdmin).not.toHaveBeenCalled();
    expect(links.createShortLink).not.toHaveBeenCalled();
  });

  it("treats an empty Authorization header as a failed bearer attempt", async () => {
    const { POST } = await import("@/app/api/links/route");
    apiTokens.authenticateApiToken.mockResolvedValue(null);
    auth.requireAdmin.mockResolvedValue({ id: "user_session", role: "USER" });

    const response = await POST(jsonRequest(
      { destinationUrl: "https://example.com" },
      "",
      { origin: "http://localhost:3000", "X-Surls-CSRF": "csrf-token" }
    ));

    expect(response.status).toBe(401);
    expect(auth.requireAdmin).not.toHaveBeenCalled();
  });

  it("rejects a foreign Origin for session creation", async () => {
    const { POST } = await import("@/app/api/links/route");
    apiTokens.authenticateApiToken.mockResolvedValue(null);
    auth.requireAdmin.mockResolvedValue({ id: "user_session", role: "USER" });

    const response = await POST(jsonRequest(
      { destinationUrl: "https://example.com" },
      undefined,
      { origin: "https://foreign.invalid", "X-Surls-CSRF": "csrf-token" }
    ));

    expect(response.status).toBe(403);
    expect(links.createShortLink).not.toHaveBeenCalled();
  });

  it("requires the literal configured Origin rather than a same-origin URL with a path", async () => {
    const { POST } = await import("@/app/api/links/route");
    apiTokens.authenticateApiToken.mockResolvedValue(null);
    auth.requireAdmin.mockResolvedValue({ id: "user_session", role: "USER" });

    const response = await POST(jsonRequest(
      { destinationUrl: "https://example.com" },
      undefined,
      { origin: "http://localhost:3000/not-an-origin", "X-Surls-CSRF": "csrf-token" }
    ));

    expect(response.status).toBe(403);
    expect(links.createShortLink).not.toHaveBeenCalled();
  });

  it("requires an Origin for session creation even with a valid CSRF header", async () => {
    const { POST } = await import("@/app/api/links/route");
    apiTokens.authenticateApiToken.mockResolvedValue(null);
    auth.requireAdmin.mockResolvedValue({ id: "user_session", role: "USER" });

    const response = await POST(jsonRequest(
      { destinationUrl: "https://example.com" },
      undefined,
      { "X-Surls-CSRF": "csrf-token" }
    ));

    expect(response.status).toBe(403);
    expect(links.createShortLink).not.toHaveBeenCalled();
  });

  it("requires JSON and bounds request and field sizes", async () => {
    const { POST } = await import("@/app/api/links/route");
    apiTokens.authenticateApiToken.mockResolvedValue({
      name: "Automation",
      tokenPrefix: "surls_abc123",
      user: { id: "user_api", role: "USER" }
    });

    const wrongType = await POST(jsonRequest(
      { destinationUrl: "https://example.com" },
      "Bearer surls_valid",
      { "content-type": "text/plain" }
    ));
    const tooLarge = await POST(jsonRequest(
      { destinationUrl: "https://example.com" },
      "Bearer surls_valid",
      { "content-length": String(64 * 1024 + 1) }
    ));
    const longTitle = await POST(jsonRequest(
      { destinationUrl: "https://example.com", title: "x".repeat(241) },
      "Bearer surls_valid"
    ));

    expect(wrongType.status).toBe(415);
    expect(tooLarge.status).toBe(413);
    expect(longTitle.status).toBe(400);
    expect(links.createShortLink).not.toHaveBeenCalled();
  });

  it("enforces the streaming body cap without relying on Content-Length", async () => {
    const { POST } = await import("@/app/api/links/route");
    apiTokens.authenticateApiToken.mockResolvedValue({
      name: "Automation",
      tokenPrefix: "surls_abc123",
      user: { id: "user_api", role: "USER" }
    });
    const request = new NextRequest("http://localhost:3000/api/links", {
      body: JSON.stringify({ destinationUrl: "https://example.com", notes: "x".repeat(65 * 1024) }),
      headers: {
        authorization: "Bearer surls_valid",
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(request.headers.get("content-length")).toBeNull();
    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(links.createShortLink).not.toHaveBeenCalled();
  });
});
