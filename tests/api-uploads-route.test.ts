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
  normalizeUploadFilenameMode: vi.fn(() => "safe")
}));

const uploadAndShorten = vi.hoisted(() => ({
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

describe("POST /api/uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true });
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
});
