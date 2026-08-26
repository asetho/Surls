import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/redirect-path";

describe("safe redirect paths", () => {
  it("preserves canonical same-origin paths, queries, and fragments", () => {
    expect(safeRedirectPath("/admin/links?page=2#recent")).toBe("/admin/links?page=2#recent");
  });

  it("rejects values that can change meaning during URL parsing", () => {
    expect(safeRedirectPath("//external.invalid/path")).toBe("/admin");
    expect(safeRedirectPath("/admin\\settings")).toBe("/admin");
    expect(safeRedirectPath("/admin\t/settings")).toBe("/admin");
    expect(safeRedirectPath("https://external.invalid/path")).toBe("/admin");
  });

  it("uses only a safe canonical fallback", () => {
    expect(safeRedirectPath("invalid", "/bookmarklet?mode=create")).toBe("/bookmarklet?mode=create");
    expect(safeRedirectPath("invalid", "//external.invalid")).toBe("/admin");
  });
});
