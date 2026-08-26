import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadGrants = vi.hoisted(() => ({
  hasValidUploadDownloadGrant: vi.fn()
}));

const uploadedFileRecords = vi.hoisted(() => ({
  uploadedFileDownloadName: vi.fn()
}));

vi.mock("@/lib/upload-grants", () => uploadGrants);
vi.mock("@/lib/uploaded-file-records", () => uploadedFileRecords);

async function withUploadsRoute(
  run: (route: typeof import("@/app/uploads/[...path]/route")) => Promise<void>
) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "surls-upload-route-"));
  await writeFile(path.join(dir, "payload.html"), "<script>window.pwned = true</script>");
  vi.resetModules();
  vi.stubEnv("UPLOADS_DIR", dir);
  try {
    await run(await import("@/app/uploads/[...path]/route"));
  } finally {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  }
}

describe("uploaded file route", () => {
  beforeEach(() => {
    uploadGrants.hasValidUploadDownloadGrant.mockReset();
    uploadGrants.hasValidUploadDownloadGrant.mockResolvedValue(true);
    uploadedFileRecords.uploadedFileDownloadName.mockReset();
    uploadedFileRecords.uploadedFileDownloadName.mockResolvedValue("Original payload.html");
  });

  it("forces downloads for uploaded active content while preserving the file response", async () => {
    await withUploadsRoute(async ({ GET, HEAD }) => {
      const params = { params: Promise.resolve({ path: ["payload.html"] }) };

      const getResponse = await GET(new Request("http://localhost:3000/uploads/payload.html"), params);
      expect(getResponse.status).toBe(200);
      expect(getResponse.headers.get("content-disposition")).toContain("filename*=UTF-8''Original%20payload.html");
      expect(getResponse.headers.get("cache-control")).toBe("private, no-store");
      expect(getResponse.headers.get("content-type")).toBe("text/html; charset=utf-8");
      await expect(getResponse.text()).resolves.toBe("<script>window.pwned = true</script>");

      const headResponse = await HEAD(new Request("http://localhost:3000/uploads/payload.html"), params);
      expect(headResponse.status).toBe(200);
      expect(headResponse.headers.get("content-disposition")).toContain("filename*=UTF-8''Original%20payload.html");
      expect(headResponse.headers.get("cache-control")).toBe("private, no-store");
      await expect(headResponse.text()).resolves.toBe("");

      expect(uploadGrants.hasValidUploadDownloadGrant).toHaveBeenNthCalledWith(
        1,
        expect.any(Request),
        "payload.html",
        "GET"
      );
      expect(uploadGrants.hasValidUploadDownloadGrant).toHaveBeenNthCalledWith(
        2,
        expect.any(Request),
        "payload.html",
        "HEAD"
      );
    });
  });

  it("returns not found without a valid link-bound download grant", async () => {
    uploadGrants.hasValidUploadDownloadGrant.mockResolvedValue(false);

    await withUploadsRoute(async ({ GET, HEAD }) => {
      const params = { params: Promise.resolve({ path: ["payload.html"] }) };

      const getResponse = await GET(new Request("http://localhost:3000/uploads/payload.html"), params);
      expect(getResponse.status).toBe(404);
      expect(getResponse.headers.get("cache-control")).toBe("no-store");

      const headResponse = await HEAD(new Request("http://localhost:3000/uploads/payload.html"), params);
      expect(headResponse.status).toBe(404);
      await expect(headResponse.text()).resolves.toBe("");
    });
  });
});
