import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiTokenModel = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { apiToken: apiTokenModel }
}));

import {
  API_TOKEN_SCOPE_LINKS_CREATE,
  API_TOKEN_SCOPE_UPLOADS_CREATE,
  authenticateApiToken,
  createApiToken,
  normalizeApiTokenName,
  tokenHasScope
} from "@/lib/api-tokens";

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  apiTokenModel.create.mockReset();
  apiTokenModel.findUnique.mockReset();
  apiTokenModel.update.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("API token hardening", () => {
  it("rejects missing and oversized token names", () => {
    expect(() => normalizeApiTokenName(" ")).toThrow(/required/i);
    expect(() => normalizeApiTokenName("x".repeat(121))).toThrow(/120 characters or fewer/i);
  });
  it("creates scoped API tokens with the default expiration window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T12:00:00.000Z"));
    apiTokenModel.create.mockImplementation(async ({ data }: { data: { userId: string; [key: string]: unknown } }) => ({
      id: "token-1",
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: null,
      updatedAt: new Date(),
      user: null,
      ...data
    }));

    const { row, token } = await createApiToken("user-1", "Automation");

    expect(token).toMatch(/^surls_/);
    expect(row.scopes).toBe(`${API_TOKEN_SCOPE_LINKS_CREATE},${API_TOKEN_SCOPE_UPLOADS_CREATE}`);
    expect(row.expiresAt?.toISOString()).toBe("2026-09-09T12:00:00.000Z");
    expect(apiTokenModel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        expiresAt: new Date("2026-09-09T12:00:00.000Z"),
        name: "Automation",
        scopes: `${API_TOKEN_SCOPE_LINKS_CREATE},${API_TOKEN_SCOPE_UPLOADS_CREATE}`,
        tokenHash: expect.any(String),
        tokenPrefix: expect.any(String),
        userId: "user-1"
      })
    });
    expect(row.expiresAt?.getTime()).toBe(new Date("2026-06-11T12:00:00.000Z").getTime() + 90 * DAY_MS);
  });

  it("recognizes exact token scopes", () => {
    expect(tokenHasScope("links:create,links:read", API_TOKEN_SCOPE_LINKS_CREATE)).toBe(true);
    expect(tokenHasScope("links:create,uploads:create", API_TOKEN_SCOPE_UPLOADS_CREATE)).toBe(true);
    expect(tokenHasScope("links:read", API_TOKEN_SCOPE_LINKS_CREATE)).toBe(false);
  });

  it("rejects expired tokens without updating last-used time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T12:00:00.000Z"));
    apiTokenModel.findUnique.mockResolvedValue({
      expiresAt: new Date("2026-06-10T12:00:00.000Z"),
      id: "token-1",
      revokedAt: null,
      scopes: API_TOKEN_SCOPE_LINKS_CREATE,
      user: { id: "user-1" }
    });

    await expect(authenticateApiToken("Bearer surls_example", API_TOKEN_SCOPE_LINKS_CREATE)).resolves.toBeNull();
    expect(apiTokenModel.update).not.toHaveBeenCalled();
  });

  it("rejects tokens that do not include the required scope", async () => {
    apiTokenModel.findUnique.mockResolvedValue({
      expiresAt: null,
      id: "token-1",
      revokedAt: null,
      scopes: "links:read",
      user: { id: "user-1" }
    });

    await expect(authenticateApiToken("Bearer surls_example", API_TOKEN_SCOPE_LINKS_CREATE)).resolves.toBeNull();
    expect(apiTokenModel.update).not.toHaveBeenCalled();
  });

  it("updates last-used time only for active tokens with the required scope", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T12:00:00.000Z"));
    const row = {
      expiresAt: new Date("2026-06-12T12:00:00.000Z"),
      id: "token-1",
      revokedAt: null,
      scopes: API_TOKEN_SCOPE_LINKS_CREATE,
      user: { id: "user-1" }
    };
    apiTokenModel.findUnique.mockResolvedValue(row);
    apiTokenModel.update.mockResolvedValue(row);

    await expect(authenticateApiToken("Bearer surls_example", API_TOKEN_SCOPE_LINKS_CREATE)).resolves.toBe(row);
    expect(apiTokenModel.update).toHaveBeenCalledWith({
      data: { lastUsedAt: new Date("2026-06-11T12:00:00.000Z") },
      where: { id: "token-1" }
    });
  });
});
