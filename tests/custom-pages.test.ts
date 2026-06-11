import { describe, expect, it } from "vitest";
import {
  LOGIN_FORM_PLACEHOLDER,
  normalizeCustomHtmlPage,
  pageFromUpload,
  splitLoginFormPlaceholder,
  validateLoginPageTemplate
} from "@/lib/custom-pages";

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
});
