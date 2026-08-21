import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiTokens = vi.hoisted(() => ({
  API_TOKEN_SCOPE_UPLOADS_CREATE: "uploads:create",
  authenticateApiToken: vi.fn()
}));

const rateLimit = vi.hoisted(() => ({
  checkRateLimit: vi.fn()
}));

const uploads = vi.hoisted(() => ({
  normalizeUploadFilenameMode: vi.fn(() => "safe"),
  uploadMaxBytes: vi.fn(() => 25 * 1024 * 1024)
}));

const uploadAndShorten = vi.hoisted(() => ({
  checkUploadShortCodeAvailability: vi.fn(),
  uploadAndShortenFile: vi.fn()
}));

vi.mock("@/lib/api-tokens", () => apiTokens);
vi.mock("@/lib/rate-limit", () => rateLimit);
vi.mock("@/lib/uploads", () => uploads);
vi.mock("@/lib/upload-and-shorten", () => uploadAndShorten);

function uploadRequest(authorization = "Bearer surls_valid") {
  const formData = new FormData();
  formData.set("file", new File(["hello"], "hello world.txt", { type: "text/plain" }));
  formData.set("filenameMode", "safe");
  formData.set("title", "Shared document");
  return new NextRequest("http://localhost:3000/api/uploads", {
    body: formData,
    headers: { authorization },
    method: "POST"
  });
}

describe("HEAD /api/uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiTokens.authenticateApiToken.mockResolvedValue({
      name: "Mac Share",
      tokenPrefix: "surls_abc123",
      userId: "user_123"
    });
  });

  it("validates a token with the upload scope without uploading a file", async () => {
    const { HEAD } = await import("@/app/api/uploads/route");
    const request = new NextRequest("http://localhost:3000/api/uploads", {
      headers: { authorization: "Bearer surls_valid" },
      method: "HEAD"
    });

    const response = await HEAD(request);

    expect(response.status).toBe(204);
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
});

describe("POST /api/uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true });
    uploads.uploadMaxBytes.mockReturnValue(25 * 1024 * 1024);
    apiTokens.authenticateApiToken.mockResolvedValue({
      name: "Mac Share",
      tokenPrefix: "surls_abc123",
      userId: "user_123"
    });
    uploadAndShorten.uploadAndShortenFile.mockResolvedValue({
      code: "abc123",
      filename: "hello_world.txt",
      fileUrl: "https://example.test/uploads/hello_world.txt",
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
      via: "api-upload"
    }));
  });

  it("returns rate-limit failures before reading the upload", async () => {
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: false });
    const { POST } = await import("@/app/api/uploads/route");

    const response = await POST(uploadRequest());

    expect(response.status).toBe(429);
    expect(uploadAndShorten.uploadAndShortenFile).not.toHaveBeenCalled();
  });

  it("rejects streamed multipart requests before buffering an oversized body", async () => {
    uploads.uploadMaxBytes.mockReturnValue(8);
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
    await expect(response.json()).resolves.toEqual({ error: "Upload request is too large." });
    expect(uploadAndShorten.uploadAndShortenFile).not.toHaveBeenCalled();
  });
});

describe("GET /api/uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true });
    apiTokens.authenticateApiToken.mockResolvedValue({
      name: "Mac Share",
      tokenPrefix: "surls_abc123",
      userId: "user_123"
    });
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
