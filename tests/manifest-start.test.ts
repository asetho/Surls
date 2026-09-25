import { describe, expect, it } from "vitest";
import { manifestHrefForPath, safeManifestStartPath } from "@/lib/manifest-start";

describe("web app install paths", () => {
  it("links each page to a manifest with that page as its start path", () => {
    expect(manifestHrefForPath("/")).toBe("/site.webmanifest");
    expect(manifestHrefForPath("/admin")).toBe("/site.webmanifest?start=%2Fadmin");
    expect(manifestHrefForPath("/admin/links/123")).toBe("/site.webmanifest?start=%2Fadmin%2Flinks%2F123");
  });

  it("falls back to the home page for external URLs, queries, and controls", () => {
    for (const value of [null, "https://other.example/admin", "//other.example/admin", "/admin?token=secret", "/admin#section", "/admin\\evil", "/admin\n"]) {
      expect(safeManifestStartPath(value)).toBe("/");
    }
  });
});
