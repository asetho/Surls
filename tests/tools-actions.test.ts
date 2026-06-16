import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  requireAdmin: vi.fn()
}));

const apiTokens = vi.hoisted(() => ({
  createApiToken: vi.fn()
}));

const audit = vi.hoisted(() => ({
  auditLog: vi.fn()
}));

const csrf = vi.hoisted(() => ({
  validateCsrf: vi.fn()
}));

const settings = vi.hoisted(() => ({
  getSiteName: vi.fn()
}));

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  apiToken: {
    updateMany: vi.fn()
  },
  shortLink: {
    findMany: vi.fn()
  }
}));

const links = vi.hoisted(() => ({
  createShortLink: vi.fn()
}));

const urlSafety = vi.hoisted(() => ({
  assertNoPrivateResolution: vi.fn()
}));

const nextCache = vi.hoisted(() => ({
  revalidatePath: vi.fn()
}));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/api-tokens", () => apiTokens);
vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/csrf", () => csrf);
vi.mock("@/lib/settings", () => settings);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/links", () => links);
vi.mock("next/cache", () => nextCache);
vi.mock("@/lib/url-safety", async () => {
  const actual = await vi.importActual<typeof import("@/lib/url-safety")>("@/lib/url-safety");
  return {
    ...actual,
    assertNoPrivateResolution: urlSafety.assertNoPrivateResolution
  };
});

function tokenForm(expiresInDays: string) {
  const formData = new FormData();
  formData.set("name", "Automation token");
  formData.set("expiresInDays", expiresInDays);
  return formData;
}

function importForm(csv: string, confirm = false) {
  const formData = new FormData();
  formData.set("csv", csv);
  if (confirm) formData.set("confirm", "on");
  return formData;
}

describe("tools actions hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAdmin.mockResolvedValue({ id: "user_123", role: "ADMIN" });
    settings.getSiteName.mockResolvedValue("Surls");
    apiTokens.createApiToken.mockResolvedValue({
      row: {
        expiresAt: new Date("2026-07-11T12:00:00.000Z"),
        id: "token_123",
        scopes: "links:create",
        tokenPrefix: "surls_abc123"
      },
      token: "surls_plain"
    });
    prisma.shortLink.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (callback) => callback({ shortLink: {} }));
    links.createShortLink.mockResolvedValue({ id: "link_123" });
    urlSafety.assertNoPrivateResolution.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates API tokens with the selected expiration window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T12:00:00.000Z"));
    const { createTokenAction } = await import("@/app/admin/tools/actions");

    await expect(createTokenAction(null, tokenForm("30"))).resolves.toEqual({ token: "surls_plain" });

    expect(apiTokens.createApiToken).toHaveBeenCalledWith("user_123", "Automation token", {
      expiresAt: new Date("2026-07-11T12:00:00.000Z")
    });
    expect(audit.auditLog).toHaveBeenCalledWith(expect.objectContaining({
      details: expect.objectContaining({ scopes: "links:create", tokenPrefix: "surls_abc123" })
    }));
  });

  it("falls back to the configured token expiration when the submitted choice is invalid", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T12:00:00.000Z"));
    const { createTokenAction } = await import("@/app/admin/tools/actions");

    await createTokenAction(null, tokenForm("999"));

    expect(apiTokens.createApiToken).toHaveBeenCalledWith("user_123", "Automation token", {
      expiresAt: new Date("2026-09-09T12:00:00.000Z")
    });
  });

  it("rejects private or internal destinations during CSV import preview", async () => {
    const { importCsvAction } = await import("@/app/admin/tools/actions");
    urlSafety.assertNoPrivateResolution.mockRejectedValue(new Error("Destination resolves to a private or internal address."));

    const result = await importCsvAction(null, importForm("https://internal.example,safe,Internal"));

    expect(result.imported).toBe(0);
    expect(result.errors).toEqual(["Row 1: Destination resolves to a private or internal address."]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(links.createShortLink).not.toHaveBeenCalled();
  });

  it("does not create partial links when a confirmed CSV import has one unsafe row", async () => {
    const { importCsvAction } = await import("@/app/admin/tools/actions");
    urlSafety.assertNoPrivateResolution
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("Destination resolves to a private or internal address."));

    const result = await importCsvAction(
      null,
      importForm("https://example.com,safe,Good\nhttps://internal.example,bad,Bad", true)
    );

    expect(result.imported).toBe(0);
    expect(result.errors).toEqual(["Row 2: Destination resolves to a private or internal address."]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(links.createShortLink).not.toHaveBeenCalled();
  });
});
