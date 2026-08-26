import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiTokens = vi.hoisted(() => ({
  API_TOKEN_SCOPE_UPLOADS_CREATE: "uploads:create",
  authenticateApiToken: vi.fn()
}));

const auth = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
const csrf = vi.hoisted(() => ({ validateCsrfValue: vi.fn() }));

const rateLimit = vi.hoisted(() => ({
  checkRateLimit: vi.fn()
}));

const uploads = vi.hoisted(() => ({
  normalizeUploadFilenameMode: vi.fn(() => "safe"),
  uploadMaxBytesLabel: vi.fn((bytes: number | null) => bytes === null ? "No limit" : `${bytes} bytes`)
}));

const uploadLimits = vi.hoisted(() => ({
  getEffectiveUploadMaxBytes: vi.fn()
}));

const uploadAndShorten = vi.hoisted(() => ({
  checkUploadShortCodeAvailability: vi.fn(),
  uploadAndShortenFile: vi.fn()
}));

vi.mock("@/lib/api-tokens", () => apiTokens);
vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/csrf", () => csrf);
vi.mock("@/lib/rate-limit", () => rateLimit);
vi.mock("@/lib/uploads", () => uploads);
vi.mock("@/lib/upload-limits", () => uploadLimits);
vi.mock("@/lib/upload-and-shorten", () => uploadAndShorten);

function uploadRequest(
  authorization: string | null = "Bearer surls_valid",
  csrfToken?: string,
  origin = authorization ? undefined : "http://localhost:3000"
) {
  const formData = new FormData();
  formData.set("file", new File(["hello"], "hello world.txt", { type: "text/plain" }));
  formData.set("filenameMode", "safe");
  formData.set("title", "Shared document");
  return new NextRequest("http://localhost:3000/api/uploads", {
    body: formData,
    headers: {
      ...(authorization ? { authorization } : {}),
      ...(csrfToken ? { "X-Surls-CSRF": csrfToken } : {}),
      ...(origin ? { origin } : {})
    },
    method: "POST"
  });
}

describe("HEAD /api/uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAdmin.mockResolvedValue(null);
    apiTokens.authenticateApiToken.mockResolvedValue({
      name: "Mac Share",
      tokenPrefix: "surls_abc123",
      userId: "user_123",
      user: { id: "user_123" }
    });
    uploadLimits.getEffectiveUploadMaxBytes.mockResolvedValue(25 * 1024 * 1024);
  });

  it("validates a token with the upload scope without uploading a file", async () => {
    const { HEAD } = await import("@/app/api/uploads/route");
    const request = new NextRequest("http://localhost:3000/api/uploads", {
      headers: { authorization: "Bearer surls_valid" },
      method: "HEAD"
    });

    const response = await HEAD(request);

    expect(response.status).toBe(204);
    expect(response.headers.get("X-Surls-Upload-Max-Bytes")).toBe(String(25 * 1024 * 1024));
    expect(apiTokens.authenticateApiToken).toHaveBeenCalledWith("Bearer surls_valid", "uploads:create");
    expect(uploadAndShorten.uploadAndShortenFile).not.toHaveBeenCalled();
  });

  it("rejects a token without the upload scope", async () => {
    apiTokens.authenticateApiToken.mockResolvedValue(null);
    const { HEAD } = await import("@/app/api/uploads/route");
    const request = new NextRequest("http://localhost:3000/api/uploads", {
      headers: { authorization: "Bearer surls_links_only" },
      method: "HEAD"
    });

    const response = await HEAD(request);

    expect(response.status).toBe(401);
    expect(uploadAndShorten.uploadAndShortenFile).not.toHaveBeenCalled();
  });

  it("reports when the user has no Surls application upload limit", async () => {
    uploadLimits.getEffectiveUploadMaxBytes.mockResolvedValue(null);
    const { HEAD } = await import("@/app/api/uploads/route");
    const request = new NextRequest("http://localhost:3000/api/uploads", {
      headers: { authorization: "Bearer surls_valid" },
      method: "HEAD"
    });

    const response = await HEAD(request);

    expect(response.status).toBe(204);
    expect(response.headers.get("X-Surls-Upload-Max-Bytes")).toBe("unlimited");
  });
});

describe("POST /api/uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAdmin.mockResolvedValue(null);
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true });
    uploadLimits.getEffectiveUploadMaxBytes.mockResolvedValue(25 * 1024 * 1024);
    apiTokens.authenticateApiToken.mockResolvedValue({
      name: "Mac Share",
      tokenPrefix: "surls_abc123",
      userId: "user_123",
      user: { id: "user_123" }
    });
    uploadAndShorten.uploadAndShortenFile.mockResolvedValue({
      code: "abc123",
      filename: "hello_world.txt",
      shortUrl: "https://example.test/abc123"
    });
  });

  it("requires a token with the upload scope", async () => {
    apiTokens.authenticateApiToken.mockResolvedValue(null);
    const { POST } = await import("@/app/api/uploads/route");

    const response = await POST(uploadRequest("Bearer surls_links_only"));

    expect(response.status).toBe(401);
    expect(apiTokens.authenticateApiToken).toHaveBeenCalledWith("Bearer surls_links_only", "uploads:create");
    expect(uploadAndShorten.uploadAndShortenFile).not.toHaveBeenCalled();
  });

  it("does not fall back to a browser session when an Authorization header is invalid", async () => {
    apiTokens.authenticateApiToken.mockResolvedValue(null);
    auth.requireAdmin.mockResolvedValue({ id: "user_web" });
    const { POST } = await import("@/app/api/uploads/route");

    const response = await POST(uploadRequest("Bearer invalid"));

    expect(response.status).toBe(401);
    expect(auth.requireAdmin).not.toHaveBeenCalled();
    expect(uploadAndShorten.uploadAndShortenFile).not.toHaveBeenCalled();
  });

  it("treats an empty Authorization header as a failed bearer attempt", async () => {
    apiTokens.authenticateApiToken.mockResolvedValue(null);
    auth.requireAdmin.mockResolvedValue({ id: "user_web" });
    const { POST } = await import("@/app/api/uploads/route");
    const formData = new FormData();
    formData.set("file", new File(["hello"], "hello.txt"));
    const request = new NextRequest("http://localhost:3000/api/uploads", {
      body: formData,
      headers: { authorization: "", origin: "http://localhost:3000", "X-Surls-CSRF": "csrf-token" },
      method: "POST"
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(auth.requireAdmin).not.toHaveBeenCalled();
  });

  it("uploads a multipart file and returns its short URL", async () => {
    const { POST } = await import("@/app/api/uploads/route");

    const response = await POST(uploadRequest());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      filename: "hello_world.txt",
      shortUrl: "https://example.test/abc123"
    });
    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith("api:upload:user_123", 30, 60_000);
    expect(uploadAndShorten.uploadAndShortenFile).toHaveBeenCalledWith(expect.objectContaining({
      createdByApiTokenName: "Mac Share",
      createdByApiTokenPrefix: "surls_abc123",
      createdById: "user_123",
      file: expect.any(File),
      filenameMode: "safe",
      title: "Shared document",
      uploadMaxBytes: 25 * 1024 * 1024,
      via: "api-upload"
    }));
  });

  it("uses the same endpoint for session-authenticated web uploads with CSRF protection", async () => {
    apiTokens.authenticateApiToken.mockResolvedValue(null);
    auth.requireAdmin.mockResolvedValue({ id: "user_web" });
    const { POST } = await import("@/app/api/uploads/route");

    const response = await POST(uploadRequest(null, "csrf-token"));

    expect(response.status).toBe(201);
    expect(csrf.validateCsrfValue).toHaveBeenCalledWith("csrf-token");
    expect(uploadAndShorten.uploadAndShortenFile).toHaveBeenCalledWith(expect.objectContaining({
      createdByApiTokenName: undefined,
      createdByApiTokenPrefix: undefined,
      createdById: "user_web",
      uploadMaxBytes: 25 * 1024 * 1024
    }));
  });

  it("rejects session-authenticated uploads with an invalid CSRF token", async () => {
    apiTokens.authenticateApiToken.mockResolvedValue(null);
    auth.requireAdmin.mockResolvedValue({ id: "user_web" });
    csrf.validateCsrfValue.mockImplementation(() => {
      throw new Error("Invalid CSRF token");
    });
    const { POST } = await import("@/app/api/uploads/route");

    const response = await POST(uploadRequest(null));

    expect(response.status).toBe(403);
    expect(uploadAndShorten.uploadAndShortenFile).not.toHaveBeenCalled();
  });

  it("rejects session-authenticated uploads without an exact same-origin Origin header", async () => {
    apiTokens.authenticateApiToken.mockResolvedValue(null);
    auth.requireAdmin.mockResolvedValue({ id: "user_web" });
    const { POST } = await import("@/app/api/uploads/route");

    const missingOrigin = await POST(uploadRequest(null, "csrf-token", ""));
    expect(missingOrigin.status).toBe(403);

    const foreignOrigin = await POST(uploadRequest(null, "csrf-token", "https://example.test"));
    expect(foreignOrigin.status).toBe(403);
    expect(uploadAndShorten.uploadAndShortenFile).not.toHaveBeenCalled();
  });

  it("requires multipart form data", async () => {
    const { POST } = await import("@/app/api/uploads/route");
    const request = new NextRequest("http://localhost:3000/api/uploads", {
      body: JSON.stringify({ filename: "hello.txt" }),
      headers: { authorization: "Bearer surls_valid", "content-type": "application/json" },
      method: "POST"
    });

    const response = await POST(request);

    expect(response.status).toBe(415);
    expect(uploadAndShorten.uploadAndShortenFile).not.toHaveBeenCalled();
  });

  it("bounds upload titles", async () => {
    const formData = new FormData();
    formData.set("file", new File(["hello"], "hello.txt", { type: "text/plain" }));
    formData.set("title", "x".repeat(241));
    const { POST } = await import("@/app/api/uploads/route");
    const request = new NextRequest("http://localhost:3000/api/uploads", {
      body: formData,
      headers: { authorization: "Bearer surls_valid" },
      method: "POST"
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Title must be 240 characters or fewer." });
    expect(uploadAndShorten.uploadAndShortenFile).not.toHaveBeenCalled();
  });

  it("limits concurrent multipart parsing per process", async () => {
    let releaseUpload!: (value: { code: string; filename: string; shortUrl: string }) => void;
    const blocked = new Promise<{ code: string; filename: string; shortUrl: string }>((resolve) => {
      releaseUpload = resolve;
    });
    uploadAndShorten.uploadAndShortenFile.mockReturnValue(blocked);
    const { POST, UPLOAD_MAX_CONCURRENT_REQUESTS } = await import("@/app/api/uploads/route");
    const active = Array.from({ length: UPLOAD_MAX_CONCURRENT_REQUESTS }, () => POST(uploadRequest()));
    await vi.waitFor(() => {
      expect(uploadAndShorten.uploadAndShortenFile).toHaveBeenCalledTimes(UPLOAD_MAX_CONCURRENT_REQUESTS);
    });

    const rejected = await POST(uploadRequest());
    expect(rejected.status).toBe(503);
    expect(rejected.headers.get("retry-after")).toBe("5");

    releaseUpload({ code: "abc123", filename: "hello.txt", shortUrl: "https://example.test/abc123" });
    await Promise.all(active);
  });

  it("returns rate-limit failures before reading the upload", async () => {
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: false });
    const { POST } = await import("@/app/api/uploads/route");

    const response = await POST(uploadRequest());

    expect(response.status).toBe(429);
    expect(uploadAndShorten.uploadAndShortenFile).not.toHaveBeenCalled();
  });

  it("rejects streamed multipart requests before buffering an oversized body", async () => {
    uploadLimits.getEffectiveUploadMaxBytes.mockResolvedValue(8);
    const { POST, UPLOAD_MULTIPART_OVERHEAD_BYTES } = await import("@/app/api/uploads/route");
    const boundary = "surls-test-boundary";
    const prefix = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="large.txt"\r\nContent-Type: text/plain\r\n\r\n`;
    const suffix = `\r\n--${boundary}--\r\n`;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(prefix));
        controller.enqueue(new Uint8Array(UPLOAD_MULTIPART_OVERHEAD_BYTES + 9));
        controller.enqueue(encoder.encode(suffix));
        controller.close();
      }
    });
    type StreamRequestInit = NonNullable<ConstructorParameters<typeof NextRequest>[1]> & { duplex: "half" };
    const request = new NextRequest("http://localhost:3000/api/uploads", {
      body,
      headers: {
        authorization: "Bearer surls_valid",
        "content-type": `multipart/form-data; boundary=${boundary}`
      },
      method: "POST",
      duplex: "half"
    } as StreamRequestInit);

    const response = await POST(request);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "Upload files up to 8 bytes at a time." });
    expect(uploadAndShorten.uploadAndShortenFile).not.toHaveBeenCalled();
  });
});

describe("GET /api/uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAdmin.mockResolvedValue(null);
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true });
    apiTokens.authenticateApiToken.mockResolvedValue({
      name: "Mac Share",
      tokenPrefix: "surls_abc123",
      userId: "user_123",
      user: { id: "user_123" }
    });
    uploadLimits.getEffectiveUploadMaxBytes.mockResolvedValue(25 * 1024 * 1024);
    uploadAndShorten.checkUploadShortCodeAvailability.mockResolvedValue({ available: true, error: null });
  });

  it("checks a custom short keyword with an upload-scoped token", async () => {
    const { GET } = await import("@/app/api/uploads/route");
    const request = new NextRequest("http://localhost:3000/api/uploads?code=project-file", {
      headers: { authorization: "Bearer surls_valid" },
      method: "GET"
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ available: true, error: null });
    expect(response.headers.get("X-Surls-Upload-Max-Bytes")).toBe(String(25 * 1024 * 1024));
    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith("api:upload-code:user_123", 120, 60_000);
    expect(uploadAndShorten.checkUploadShortCodeAvailability).toHaveBeenCalledWith("project-file");
  });

  it("rejects blank keyword checks", async () => {
    const { GET } = await import("@/app/api/uploads/route");
    const request = new NextRequest("http://localhost:3000/api/uploads", {
      headers: { authorization: "Bearer surls_valid" },
      method: "GET"
    });

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(uploadAndShorten.checkUploadShortCodeAvailability).not.toHaveBeenCalled();
  });
});
