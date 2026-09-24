import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isBlockedPublicWebrootPath,
  publicWebrootFile,
  publicWebrootHealthStatus,
  publicWebrootNotFoundResponse,
  publicWebrootResponse
} from "@/lib/webroot";

async function withTempDir(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "surls-webroot-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("public webroot", () => {
  it("serves index, direct files, and directory indexes", async () => {
    await withTempDir(async (dir) => {
      await writeFile(path.join(dir, "index.html"), "<h1>Home</h1>");
      await writeFile(path.join(dir, "test.html"), "<h1>Test</h1>");
      await mkdir(path.join(dir, "docs"));
      await writeFile(path.join(dir, "docs", "index.html"), "<h1>Docs</h1>");

      const home = await publicWebrootResponse([], { rootDir: dir });
      expect(home?.status).toBe(200);
      await expect(home?.text()).resolves.toBe("<h1>Home</h1>");
      expect(home?.headers.get("content-type")).toContain("text/html");

      const directFile = await publicWebrootResponse(["test.html"], { rootDir: dir });
      await expect(directFile?.text()).resolves.toBe("<h1>Test</h1>");

      const directoryIndex = await publicWebrootResponse(["docs"], { rootDir: dir });
      await expect(directoryIndex?.text()).resolves.toBe("<h1>Docs</h1>");
    });
  });

  it("serves common static asset types, including JavaScript", async () => {
    await withTempDir(async (dir) => {
      await mkdir(path.join(dir, "assets"));
      await writeFile(path.join(dir, "assets", "site.css"), "body { color: #111; }");
      await writeFile(path.join(dir, "assets", "app.js"), "console.log('ok');");

      const css = await publicWebrootResponse(["assets", "site.css"], { rootDir: dir });
      expect(css?.headers.get("content-type")).toBe("text/css; charset=utf-8");

      const js = await publicWebrootResponse(["assets", "app.js"], { rootDir: dir });
      expect(js?.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
      await expect(js?.text()).resolves.toBe("console.log('ok');");
    });
  });

  it("blocks traversal, dotfiles, and public access to login.html", async () => {
    await withTempDir(async (dir) => {
      await writeFile(path.join(dir, ".env"), "SECRET=value");
      await writeFile(path.join(dir, "login.html"), "{{LOGIN_FORM}}");

      await expect(publicWebrootResponse(["..", "index.html"], { rootDir: dir })).resolves.toBeNull();
      await expect(publicWebrootResponse([".env"], { rootDir: dir })).resolves.toBeNull();
      await expect(publicWebrootResponse(["login.html"], { rootDir: dir })).resolves.toBeNull();
    });
  });

  it("identifies blocked public paths before short-link fallback", () => {
    expect(isBlockedPublicWebrootPath(["login.html"])).toBe(true);
    expect(isBlockedPublicWebrootPath([".env"])).toBe(true);
    expect(isBlockedPublicWebrootPath(["test.html"])).toBe(false);
  });

  it("requires an absolute webroot path", async () => {
    await expect(publicWebrootResponse([], { rootDir: "./www" })).resolves.toBeNull();
    await expect(publicWebrootHealthStatus("./www")).resolves.toBe("invalid");
  });

  it("reports a missing configured webroot", async () => {
    await withTempDir(async (dir) => {
      await expect(publicWebrootHealthStatus(path.join(dir, "missing"))).resolves.toBe("missing");
    });
  });

  it.skipIf(process.getuid?.() === 0)("detects unreadable mounted pages without requiring directory listing", async () => {
    await withTempDir(async (dir) => {
      const indexPath = path.join(dir, "index.html");
      await writeFile(indexPath, "<h1>Home</h1>");
      await chmod(dir, 0o711);
      await expect(publicWebrootHealthStatus(dir)).resolves.toBe("ok");

      await chmod(dir, 0o600);
      try {
        await expect(publicWebrootHealthStatus(dir)).resolves.toBe("unreadable");
      } finally {
        await chmod(dir, 0o711);
      }

      await chmod(indexPath, 0o000);
      try {
        await expect(publicWebrootHealthStatus(dir)).resolves.toBe("unreadable");
      } finally {
        await chmod(indexPath, 0o600);
      }
    });
  });

  it("allows .well-known files", async () => {
    await withTempDir(async (dir) => {
      await mkdir(path.join(dir, ".well-known"));
      await writeFile(path.join(dir, ".well-known", "assetlinks.json"), "{}");

      const response = await publicWebrootResponse([".well-known", "assetlinks.json"], { rootDir: dir });

      expect(response?.status).toBe(200);
      await expect(response?.text()).resolves.toBe("{}");
    });
  });

  it("uses mounted 404.html for missing public paths", async () => {
    await withTempDir(async (dir) => {
      await writeFile(path.join(dir, "404.html"), "<h1>Missing</h1>");

      const response = await publicWebrootNotFoundResponse({ rootDir: dir });

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("text/html");
      await expect(response.text()).resolves.toBe("<h1>Missing</h1>");
    });
  });

  it("returns no body for HEAD requests", async () => {
    await withTempDir(async (dir) => {
      await writeFile(path.join(dir, "index.html"), "<h1>Home</h1>");

      const response = await publicWebrootResponse([], { method: "HEAD", rootDir: dir });

      expect(response?.status).toBe(200);
      await expect(response?.text()).resolves.toBe("");
    });
  });

  it("exposes file metadata for the admin settings view", async () => {
    await withTempDir(async (dir) => {
      await writeFile(path.join(dir, "index.html"), "<h1>Home</h1>");

      const file = await publicWebrootFile([], { rootDir: dir });

      expect(file).toMatchObject({
        contentType: "text/html; charset=utf-8",
        size: 13
      });
      expect(file?.filePath.endsWith("index.html")).toBe(true);
    });
  });
});
