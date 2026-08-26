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

const uploadLimits = vi.hoisted(() => ({
  getEffectiveUploadMaxBytes: vi.fn()
}));

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  apiToken: {
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn()
  },
  auditLog: {
    create: vi.fn()
  },
  shortLink: {
    findUnique: vi.fn(),
    findMany: vi.fn()
  }
}));

const links = vi.hoisted(() => ({
  createShortLink: vi.fn(),
  shortUrl: vi.fn((baseUrl: string, code: string) => `${baseUrl.replace(/\/$/, "")}/${code}`)
}));

const uploads = vi.hoisted(() => ({
  deleteUploadedFile: vi.fn(),
  normalizeUploadFilenameMode: vi.fn((value: FormDataEntryValue | null) => (value === "random" ? "random" : "safe")),
  storeUploadedFile: vi.fn()
}));

const urlSafety = vi.hoisted(() => ({
  assertNoPrivateResolution: vi.fn(),
  resolveSafeHttpAddress: vi.fn()
}));

const pageTitle = vi.hoisted(() => ({
  fetchWithPinnedAddress: vi.fn()
}));

const nextCache = vi.hoisted(() => ({
  revalidatePath: vi.fn()
}));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/api-tokens", () => apiTokens);
vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/csrf", () => csrf);
vi.mock("@/lib/settings", () => settings);
vi.mock("@/lib/upload-limits", () => uploadLimits);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/links", () => links);
vi.mock("@/lib/uploads", () => uploads);
vi.mock("@/lib/page-title", () => pageTitle);
vi.mock("next/cache", () => nextCache);
vi.mock("@/lib/url-safety", async () => {
  const actual = await vi.importActual<typeof import("@/lib/url-safety")>("@/lib/url-safety");
  return {
    ...actual,
    assertNoPrivateResolution: urlSafety.assertNoPrivateResolution,
    resolveSafeHttpAddress: urlSafety.resolveSafeHttpAddress
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

function uploadForm() {
  const formData = new FormData();
  formData.set("file", new File(["hello"], "hello world.txt", { type: "text/plain" }));
  formData.set("code", "doc-xyz");
  formData.set("title", "File Doc");
  formData.set("filenameMode", "safe");
  return formData;
}

describe("tools actions hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAdmin.mockResolvedValue({ id: "user_123", role: "ADMIN" });
    settings.getSiteName.mockResolvedValue("Surls");
    uploadLimits.getEffectiveUploadMaxBytes.mockResolvedValue(16 * 1024 * 1024);
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
    prisma.shortLink.findUnique.mockResolvedValue(null);
    prisma.apiToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.apiToken.deleteMany.mockResolvedValue({ count: 1 });
    prisma.apiToken.findFirst.mockResolvedValue({
      createdAt: new Date("2026-05-12T12:00:00.000Z"),
      expiresAt: new Date("2026-06-11T12:00:00.000Z"),
      id: "token_123",
      name: "Automation token",
      revokedAt: null,
      scopes: "links:create,uploads:create"
    });
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
    links.createShortLink.mockResolvedValue({ id: "link_123" });
    urlSafety.assertNoPrivateResolution.mockResolvedValue(true);
    urlSafety.resolveSafeHttpAddress.mockResolvedValue({ address: "203.0.113.10", family: 4 });
    pageTitle.fetchWithPinnedAddress.mockResolvedValue(new Response(null, { status: 204 }));
    uploads.storeUploadedFile.mockResolvedValue({
      filePath: "/tmp/surls-upload/hello_world.txt",
      filename: "hello_world.txt",
      publicPath: "/uploads/hello_world.txt",
      size: 5
    });
    uploads.deleteUploadedFile.mockResolvedValue(undefined);
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

  it("creates API tokens without expiration when forever is selected", async () => {
    const { createTokenAction } = await import("@/app/admin/tools/actions");

    await createTokenAction(null, tokenForm("forever"));

    expect(apiTokens.createApiToken).toHaveBeenCalledWith("user_123", "Automation token", {
      expiresAt: null
    });
  });

  it("revokes an API token owned by the current user", async () => {
    const { revokeTokenAction } = await import("@/app/admin/tools/actions");
    const formData = new FormData();
    formData.set("id", "token_123");

    await revokeTokenAction(formData);

    expect(prisma.apiToken.updateMany).toHaveBeenCalledWith({
      where: { id: "token_123", userId: "user_123" },
      data: { revokedAt: expect.any(Date) }
    });
    expect(audit.auditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "API_TOKEN_REVOKED",
      entityId: "token_123",
      entityType: "ApiToken"
    }));
  });

  it("does not revoke an API token owned by another user", async () => {
    const { revokeTokenAction } = await import("@/app/admin/tools/actions");
    const formData = new FormData();
    formData.set("id", "victim_token");
    prisma.apiToken.updateMany.mockResolvedValue({ count: 0 });

    await revokeTokenAction(formData);

    expect(prisma.apiToken.updateMany).toHaveBeenCalledWith({
      where: { id: "victim_token", userId: "user_123" },
      data: { revokedAt: expect.any(Date) }
    });
    expect(audit.auditLog).not.toHaveBeenCalled();
  });

  it("atomically rolls an owned API token and preserves its lifetime and scopes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T12:00:00.000Z"));
    apiTokens.createApiToken.mockResolvedValueOnce({
      row: {
        expiresAt: new Date("2026-07-20T12:00:00.000Z"),
        id: "token_456",
        scopes: "links:create,uploads:create",
        tokenPrefix: "surls_def456"
      },
      token: "surls_replacement"
    });
    const { rollTokenAction } = await import("@/app/admin/tools/actions");
    const formData = new FormData();
    formData.set("id", "token_123");

    await expect(rollTokenAction(null, formData)).resolves.toEqual({
      token: "surls_replacement",
      tokenName: "Automation token"
    });

    expect(apiTokens.createApiToken).toHaveBeenCalledWith(
      "user_123",
      "Automation token",
      {
        expiresAt: new Date("2026-07-20T12:00:00.000Z"),
        scopes: ["links:create", "uploads:create"]
      },
      prisma
    );
    expect(prisma.apiToken.updateMany).toHaveBeenCalledWith({
      where: { id: "token_123", userId: "user_123", revokedAt: null },
      data: { revokedAt: new Date("2026-06-20T12:00:00.000Z") }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "API_TOKEN_REVOKED",
        entityId: "token_123",
        details: { replacementTokenId: "token_456", rolled: true }
      })
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "API_TOKEN_CREATED",
        entityId: "token_456",
        details: expect.objectContaining({ replacesTokenId: "token_123", rolled: true })
      })
    });
  });

  it("does not roll an API token owned by another user", async () => {
    const { rollTokenAction } = await import("@/app/admin/tools/actions");
    const formData = new FormData();
    formData.set("id", "victim_token");
    prisma.apiToken.findFirst.mockResolvedValue(null);

    await expect(rollTokenAction(null, formData)).resolves.toEqual({ error: "API token not found." });

    expect(prisma.apiToken.findFirst).toHaveBeenCalledWith({
      where: { id: "victim_token", userId: "user_123" },
      select: { createdAt: true, expiresAt: true, id: true, name: true, revokedAt: true, scopes: true }
    });
    expect(apiTokens.createApiToken).not.toHaveBeenCalled();
    expect(prisma.apiToken.updateMany).not.toHaveBeenCalled();
  });

  it("deletes API tokens from the tools page", async () => {
    const { deleteTokenAction } = await import("@/app/admin/tools/actions");
    const formData = new FormData();
    formData.set("id", "token_123");

    await deleteTokenAction(formData);

    expect(prisma.apiToken.deleteMany).toHaveBeenCalledWith({ where: { id: "token_123", userId: "user_123" } });
    expect(audit.auditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "API_TOKEN_REVOKED",
      details: { deleted: true },
      entityId: "token_123",
      entityType: "ApiToken"
    }));
  });

  it("does not delete an API token owned by another user", async () => {
    const { deleteTokenAction } = await import("@/app/admin/tools/actions");
    const formData = new FormData();
    formData.set("id", "victim_token");
    prisma.apiToken.deleteMany.mockResolvedValue({ count: 0 });

    await deleteTokenAction(formData);

    expect(prisma.apiToken.deleteMany).toHaveBeenCalledWith({ where: { id: "victim_token", userId: "user_123" } });
    expect(audit.auditLog).not.toHaveBeenCalled();
  });

  it("pins destination checks to the validated DNS address", async () => {
    const { checkDestinationAction } = await import("@/app/admin/tools/actions");
    const formData = new FormData();
    formData.set("url", "https://example.com/status");

    await expect(checkDestinationAction(null, formData)).resolves.toEqual({
      ok: true,
      message: "Reachable: HTTP 204"
    });
    expect(urlSafety.resolveSafeHttpAddress).toHaveBeenCalledWith("https://example.com/status");
    expect(pageTitle.fetchWithPinnedAddress).toHaveBeenCalledWith(
      "https://example.com/status",
      expect.objectContaining({
        method: "HEAD",
        redirect: "manual",
        resolvedAddress: { address: "203.0.113.10", family: 4 },
        signal: expect.any(AbortSignal)
      })
    );
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

  it("stops oversized CSV imports before validation or database work", async () => {
    const { importCsvAction } = await import("@/app/admin/tools/actions");
    const rows = Array.from({ length: 201 }, (_, index) => `https://example.com/${index}`).join("\n");

    const result = await importCsvAction(null, importForm(rows));

    expect(result).toEqual({ imported: 0, errors: ["Import at most 200 rows at a time."] });
    expect(prisma.shortLink.findMany).not.toHaveBeenCalled();
    expect(urlSafety.assertNoPrivateResolution).not.toHaveBeenCalled();
  });

  it("does not query existing aliases after detecting duplicate input aliases", async () => {
    const { importCsvAction } = await import("@/app/admin/tools/actions");

    const result = await importCsvAction(
      null,
      importForm("https://example.com/one,duplicate,One\nhttps://example.com/two,duplicate,Two")
    );

    expect(result.errors).toEqual(['Alias "duplicate" appears more than once in this import.']);
    expect(prisma.shortLink.findMany).not.toHaveBeenCalled();
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

  it("uploads a file and creates a short link to the uploaded file URL", async () => {
    const { uploadAndShortenAction } = await import("@/app/admin/tools/actions");
    links.createShortLink.mockResolvedValue({ code: "doc-xyz", id: "link_456" });

    const result = await uploadAndShortenAction(null, uploadForm());

    expect(uploads.storeUploadedFile).toHaveBeenCalledWith(expect.any(File), {
      dropExtension: false,
      filenameMode: "safe",
      maxBytes: 16 * 1024 * 1024
    });
    expect(links.createShortLink).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "doc-xyz",
        destinationUrl: "http://localhost:3000/uploads/hello_world.txt",
        fetchTitle: false,
        tags: ["Upload"],
        title: "File Doc"
      }),
      prisma,
      expect.objectContaining({
        allowPrivateDestination: true
      })
    );
    expect(audit.auditLog).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "ShortLink",
      details: expect.objectContaining({ filename: "hello_world.txt", size: 5, via: "upload" })
    }));
    expect(result).toEqual({
      code: "doc-xyz",
      filename: "hello_world.txt",
      fileUrl: "http://localhost:3000/uploads/hello_world.txt",
      shortUrl: "http://localhost:3000/doc-xyz"
    });
  });

  it("does not store an upload when the requested short alias already exists", async () => {
    const { uploadAndShortenAction } = await import("@/app/admin/tools/actions");
    prisma.shortLink.findUnique.mockResolvedValue({ id: "existing" });

    const result = await uploadAndShortenAction(null, uploadForm());

    expect(result.error).toBe("That short alias is already in use.");
    expect(uploads.storeUploadedFile).not.toHaveBeenCalled();
  });

  it("removes a stored file when short-link creation fails", async () => {
    const { uploadAndShortenAction } = await import("@/app/admin/tools/actions");
    links.createShortLink.mockRejectedValue(new Error("Could not create link"));

    const result = await uploadAndShortenAction(null, uploadForm());

    expect(result).toEqual({ error: "Could not create link" });
    expect(uploads.deleteUploadedFile).toHaveBeenCalledWith("hello_world.txt");
  });
});
