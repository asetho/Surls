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

  it("stores browser-safe filenames and avoids overwriting existing files", async () => {
    await withUploadModule(async ({ storeUploadedFile }, dir) => {
      const file = new File(["hello"], "my not safe&clean filename #1.txt", { type: "text/plain" });

      const first = await storeUploadedFile(file, { filenameMode: "safe" });
      const second = await storeUploadedFile(file, { filenameMode: "safe" });

      expect(first.filename).toBe("my_not_safe_clean_filename_1.txt");
      expect(second.filename).toMatch(/^my_not_safe_clean_filename_1-[a-f0-9]{6}\.txt$/);
      await expect(readFile(path.join(dir, first.filename), "utf8")).resolves.toBe("hello");
      await expect(readFile(path.join(dir, second.filename), "utf8")).resolves.toBe("hello");
    });
  });

  it("can keep original filenames and drop extensions", async () => {
    await withUploadModule(async ({ storeUploadedFile }) => {
      const file = new File(["hello"], "Report Final.pdf", { type: "application/pdf" });

      const stored = await storeUploadedFile(file, { dropExtension: true, filenameMode: "original" });

      expect(stored.filename).toBe("Report Final");
      expect(stored.publicPath).toBe("/uploads/Report%20Final");
    });
  });

  it("rejects files larger than the configured limit", async () => {
    await withUploadModule(async ({ storeUploadedFile }) => {
      const file = new File(["this file is too large"], "large.txt", { type: "text/plain" });

      await expect(storeUploadedFile(file)).rejects.toThrow(/up to 16 bytes/i);
    });
  });

  it("requires an absolute uploads directory", async () => {
    vi.resetModules();
    vi.stubEnv("UPLOADS_DIR", "relative/uploads");
    const { storeUploadedFile } = await import("@/lib/uploads");

    await expect(storeUploadedFile(new File(["ok"], "ok.txt"))).rejects.toThrow(/absolute path/i);
  });
});
