import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LOGIN_FORM_PLACEHOLDER,
  addNonceToCustomPageScripts,
  assetFromFilesystem,
  hasCustomPublicPages,
  normalizeCustomHtmlPage,
  pageFromFilesystem,
  pageFromUpload,
  splitLoginFormPlaceholder,
  validateLoginPageTemplate
} from "@/lib/custom-pages";

async function withTempDir(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "surls-custom-pages-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("custom page uploads", () => {
  it("normalizes stored custom pages", () => {
    expect(
      normalizeCustomHtmlPage({
        fileName: "index.html",
        html: "<h1>Hello</h1>",
        size: 14,
        updatedAt: "2026-06-09T00:00:00.000Z"
      })
    ).toEqual({
      fileName: "index.html",
      html: "<h1>Hello</h1>",
      size: 14,
      updatedAt: "2026-06-09T00:00:00.000Z"
    });
    expect(normalizeCustomHtmlPage({ fileName: "empty.html", html: "" })).toBeNull();
  });

  it("reads small html uploads", async () => {
    const page = await pageFromUpload(new File(["<!doctype html><h1>Custom</h1>"], "custom.html", { type: "text/html" }));

    expect(page.fileName).toBe("custom.html");
    expect(page.html).toBe("<!doctype html><h1>Custom</h1>");
    expect(page.size).toBeGreaterThan(0);
  });

  it("rejects non-html uploads", async () => {
    await expect(pageFromUpload(new File(["hello"], "custom.txt", { type: "text/plain" }))).rejects.toThrow(
      /\.html or \.htm/
    );
  });

  it("splits custom login templates around the trusted form placeholder", async () => {
    const html = `<main><h1>Welcome</h1>${LOGIN_FORM_PLACEHOLDER}<footer>Done</footer></main>`;
    const page = await pageFromUpload(new File([html], "login.html", { type: "text/html" }), {
      requireLoginPlaceholder: true
    });

    expect(page.html).toBe(html);
    expect(splitLoginFormPlaceholder(page.html)).toEqual({
      before: "<main><h1>Welcome</h1>",
      after: "<footer>Done</footer></main>"
    });
  });

  it("rejects custom login templates without exactly one form placeholder", async () => {
    expect(() => validateLoginPageTemplate("<main>No form here</main>")).toThrow(LOGIN_FORM_PLACEHOLDER);
    expect(() =>
      validateLoginPageTemplate(`${LOGIN_FORM_PLACEHOLDER}<hr>${LOGIN_FORM_PLACEHOLDER}`)
    ).toThrow(LOGIN_FORM_PLACEHOLDER);
    await expect(
      pageFromUpload(new File(["<main>No form here</main>"], "login.html", { type: "text/html" }), {
        requireLoginPlaceholder: true
      })
    ).rejects.toThrow(LOGIN_FORM_PLACEHOLDER);
  });

  it("adds the request nonce to custom page scripts", () => {
    expect(addNonceToCustomPageScripts("<script>run()</script>", "abc123")).toBe(
      '<script nonce="abc123">run()</script>'
    );
    expect(addNonceToCustomPageScripts('<script type="module">run()</script>', 'a"b')).toBe(
      '<script nonce="a&quot;b" type="module">run()</script>'
    );
    expect(addNonceToCustomPageScripts('<script nonce="existing">run()</script>', "abc123")).toBe(
      '<script nonce="existing">run()</script>'
    );
  });
});

describe("filesystem custom pages", () => {
  it("reads mounted index, not-found, and login pages", async () => {
    await withTempDir(async (dir) => {
      await writeFile(path.join(dir, "index.html"), "<h1>Mounted home</h1>");
      await writeFile(path.join(dir, "404.html"), "<h1>Mounted missing</h1>");
      await writeFile(path.join(dir, "login.html"), `<h1>Mounted login</h1>${LOGIN_FORM_PLACEHOLDER}`);

      await expect(pageFromFilesystem("index", dir)).resolves.toMatchObject({
        fileName: "index.html",
        html: "<h1>Mounted home</h1>"
      });
      await expect(pageFromFilesystem("notFound", dir)).resolves.toMatchObject({
        fileName: "404.html",
        html: "<h1>Mounted missing</h1>"
      });
      await expect(pageFromFilesystem("login", dir)).resolves.toMatchObject({
        fileName: "login.html",
        html: `<h1>Mounted login</h1>${LOGIN_FORM_PLACEHOLDER}`
      });
    });
  });

  it("ignores missing, empty, and oversized mounted pages", async () => {
    await withTempDir(async (dir) => {
      await expect(pageFromFilesystem("index", dir)).resolves.toBeNull();

      await writeFile(path.join(dir, "index.html"), "   ");
      await expect(pageFromFilesystem("index", dir)).resolves.toBeNull();

      await writeFile(path.join(dir, "index.html"), "x".repeat(256 * 1024 + 1));
      await expect(pageFromFilesystem("index", dir)).resolves.toBeNull();
    });
  });

  it("ignores mounted login templates without exactly one form placeholder", async () => {
    await withTempDir(async (dir) => {
      await writeFile(path.join(dir, "login.html"), "<h1>No form here</h1>");
      await expect(pageFromFilesystem("login", dir)).resolves.toBeNull();

      await writeFile(path.join(dir, "login.html"), `${LOGIN_FORM_PLACEHOLDER}<hr>${LOGIN_FORM_PLACEHOLDER}`);
      await expect(pageFromFilesystem("login", dir)).resolves.toBeNull();
    });
  });

  it("detects custom public pages but ignores login-only custom pages", async () => {
    await withTempDir(async (dir) => {
      await expect(hasCustomPublicPages(undefined, dir)).resolves.toBe(false);

      await writeFile(path.join(dir, "login.html"), `<h1>Login</h1>${LOGIN_FORM_PLACEHOLDER}`);
      await expect(hasCustomPublicPages(undefined, dir)).resolves.toBe(false);

      await writeFile(path.join(dir, "index.html"), "<h1>Mounted home</h1>");
      await expect(hasCustomPublicPages(undefined, dir)).resolves.toBe(true);
    });

    expect(
      await hasCustomPublicPages({
        customIndexPage: { fileName: "index.html", html: "<h1>Uploaded</h1>", size: 17, updatedAt: new Date(0).toISOString() },
        customNotFoundPage: null
      })
    ).toBe(true);
  });

  it("serves allowed mounted assets and blocks unsafe asset paths", async () => {
    await withTempDir(async (dir) => {
      await mkdir(path.join(dir, "assets"), { recursive: true });
      await writeFile(path.join(dir, "assets", "site.css"), "body { color: #111; }");
      await writeFile(path.join(dir, "assets", "app.js"), "alert('nope');");

      await expect(assetFromFilesystem(["site.css"], dir)).resolves.toMatchObject({
        contentType: "text/css; charset=utf-8",
        size: 21
      });
      await expect(assetFromFilesystem(["app.js"], dir)).resolves.toBeNull();
      await expect(assetFromFilesystem(["..", "index.html"], dir)).resolves.toBeNull();
      await expect(assetFromFilesystem([".secret.txt"], dir)).resolves.toBeNull();
    });
  });
});
