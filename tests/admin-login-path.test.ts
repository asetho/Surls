import { describe, expect, it } from "vitest";
import { adminLoginPath } from "@/lib/admin-login-path";

describe("adminLoginPath", () => {
  it("keeps the plain admin login path when no next path is provided", () => {
    expect(adminLoginPath()).toBe("/admin");
  });

  it("includes a safe admin deep link as the next parameter", () => {
    expect(adminLoginPath("/admin/profile")).toBe("/admin?next=%2Fadmin%2Fprofile");
  });

  it("preserves safe query strings in the next parameter", () => {
    expect(adminLoginPath("/admin/links?q=demo&page=2")).toBe(
      "/admin?next=%2Fadmin%2Flinks%3Fq%3Ddemo%26page%3D2"
    );
  });

  it("rejects external and protocol-relative destinations", () => {
    expect(adminLoginPath("https://example.com/admin")).toBe("/admin");
    expect(adminLoginPath("//example.com/admin")).toBe("/admin");
  });
});
