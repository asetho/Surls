import { describe, expect, it } from "vitest";
import { normalizeCustomHtmlPage, pageFromUpload } from "@/lib/custom-pages";

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
});
