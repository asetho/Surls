import { describe, expect, it } from "vitest";
import { adminToastPath, normalizeAdminToastType } from "@/lib/admin-toast";

describe("admin toast helpers", () => {
  it("adds toast query params to admin paths", () => {
    expect(adminToastPath("/admin/settings/theme", "success", "Dashboard theme saved.")).toBe(
      "/admin/settings/theme?toast=Dashboard+theme+saved.&toastType=success"
    );
  });

  it("replaces existing toast params and preserves unrelated params", () => {
    expect(adminToastPath("/admin/settings?toast=old&toastType=error&view=branding", "success", "Saved")).toBe(
      "/admin/settings?view=branding&toast=Saved&toastType=success"
    );
  });

  it("falls back when return paths are outside admin", () => {
    expect(adminToastPath("https://example.com/admin", "error", "Nope", "/admin/settings")).toBe(
      "/admin/settings?toast=Nope&toastType=error"
    );
  });

  it("normalizes unknown toast types to success", () => {
    expect(normalizeAdminToastType("error")).toBe("error");
    expect(normalizeAdminToastType("info")).toBe("info");
    expect(normalizeAdminToastType("wat")).toBe("success");
  });
});
