import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

async function withUploadModule<T>(run: (uploads: typeof import("@/lib/uploads"), dir: string) => Promise<T>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "surls-uploads-"));
  vi.resetModules();
  vi.stubEnv("UPLOADS_DIR", dir);
  vi.stubEnv("UPLOAD_MAX_BYTES", "16");
  try {
    const uploads = await import("@/lib/uploads");
    return await run(uploads, dir);
  } finally {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  }
}

describe("uploaded files", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stores files under opaque names while preserving a browser-safe download name", async () => {
    await withUploadModule(async ({ storeUploadedFile }, dir) => {
      const file = new File(["hello"], "my not safe&clean filename #1.txt", { type: "text/plain" });

      const first = await storeUploadedFile(file, { filenameMode: "safe" });
      const second = await storeUploadedFile(file, { filenameMode: "safe" });

      expect(first.filename).toMatch(/^[a-f0-9]{32}\.txt$/);
      expect(second.filename).toMatch(/^[a-f0-9]{32}\.txt$/);
      expect(second.filename).not.toBe(first.filename);
      expect(first.downloadName).toBe("my_not_safe_clean_filename_1.txt");
      await expect(readFile(path.join(dir, first.filename), "utf8")).resolves.toBe("hello");
      await expect(readFile(path.join(dir, second.filename), "utf8")).resolves.toBe("hello");
    });
  });

  it("can keep original filenames and drop extensions", async () => {
    await withUploadModule(async ({ storeUploadedFile }) => {
      const file = new File(["hello"], "Report Final.pdf", { type: "application/pdf" });

      const stored = await storeUploadedFile(file, { dropExtension: true, filenameMode: "original" });

      expect(stored.filename).toMatch(/^[a-f0-9]{32}$/);
      expect(stored.downloadName).toBe("Report Final");
      expect(stored.publicPath).toBe(`/uploads/${stored.filename}`);
    });
  });

  it("rejects files larger than the configured limit", async () => {
    await withUploadModule(async ({ storeUploadedFile }) => {
      const file = new File(["this file is too large"], "large.txt", { type: "text/plain" });

      await expect(storeUploadedFile(file)).rejects.toThrow(/up to 16 bytes/i);
    });
  });

  it("supports a lower explicit per-upload limit while retaining the hard process ceiling", async () => {
    await withUploadModule(async ({ storeUploadedFile }) => {
      const file = new File(["this is larger than sixteen bytes"], "large.txt", { type: "text/plain" });

      await expect(storeUploadedFile(file, { maxBytes: 8 })).rejects.toThrow(/up to 8 bytes/i);
      await expect(storeUploadedFile(file, { maxBytes: null })).resolves.toMatchObject({ size: file.size });
    });
  });

  it("streams the file to storage without making a second array-buffer copy", async () => {
    await withUploadModule(async ({ storeUploadedFile }) => {
      const file = new File(["hello"], "hello.txt", { type: "text/plain" });
      file.arrayBuffer = vi.fn(() => Promise.reject(new Error("arrayBuffer should not be used")));

      await expect(storeUploadedFile(file)).resolves.toMatchObject({ size: 5 });
      expect(file.arrayBuffer).not.toHaveBeenCalled();
    });
  });

  it("requires an absolute uploads directory", async () => {
    vi.resetModules();
    vi.stubEnv("UPLOADS_DIR", "relative/uploads");
    const { storeUploadedFile } = await import("@/lib/uploads");

    await expect(storeUploadedFile(new File(["ok"], "ok.txt"))).rejects.toThrow(/absolute path/i);
  });

  it("recognizes uploaded destinations only on this instance", async () => {
    vi.resetModules();
    vi.stubEnv("BASE_URL", "https://asetho.link");
    const { uploadContentDisposition, uploadedFilenameFromDestination, uploadedFileUrl } = await import("@/lib/uploads");

    expect(uploadedFileUrl("Report Final.pdf")).toBe("https://asetho.link/uploads/Report%20Final.pdf");
    expect(uploadedFilenameFromDestination("https://asetho.link/uploads/Report%20Final.pdf")).toBe("Report Final.pdf");
    expect(uploadedFilenameFromDestination("https://files.example/uploads/Report%20Final.pdf")).toBeNull();
    expect(uploadedFilenameFromDestination("https://asetho.link/uploads/folder/report.pdf")).toBeNull();
    expect(uploadContentDisposition("Report Final.pdf")).toContain("filename*=UTF-8''Report%20Final.pdf");
  });
});
