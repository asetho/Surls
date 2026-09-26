import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
const csrf = vi.hoisted(() => ({ validateCsrf: vi.fn() }));
const rateLimit = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const links = vi.hoisted(() => ({
  createShortLink: vi.fn(),
  normalizeOptionalDate: vi.fn(),
  normalizeOptionalPositiveInt: vi.fn()
}));
const navigation = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/csrf", () => csrf);
vi.mock("@/lib/rate-limit", () => rateLimit);
vi.mock("@/lib/links", () => links);
vi.mock("@/lib/audit", () => ({ auditLog: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => navigation);

describe("shared interactive link creation limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAdmin.mockResolvedValue({ id: "user_1" });
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: false });
    navigation.redirect.mockImplementation((path: string) => {
      throw new Error(`Redirect: ${path}`);
    });
  });

  it("rejects an admin form submission before link creation", async () => {
    const { createLinkFromFormData } = await import("@/app/admin/links/create-link");
    const formData = new FormData();
    formData.set("destinationUrl", "https://example.com");

    await expect(createLinkFromFormData(formData)).rejects.toThrow("Too many links created. Please wait and try again.");
    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith("api:create:user_1", 60, 60_000);
    expect(links.createShortLink).not.toHaveBeenCalled();
  });

  it("returns the dashboard rate-limit message as form state", async () => {
    const { createLinkAction } = await import("@/app/admin/links/actions");
    const formData = new FormData();
    formData.set("destinationUrl", "https://example.com");

    await expect(createLinkAction(null, formData)).resolves.toEqual({
      error: "Too many links created. Please wait and try again."
    });
    expect(navigation.redirect).not.toHaveBeenCalled();
    expect(links.createShortLink).not.toHaveBeenCalled();
  });

  it("still creates a link when the shared user budget allows it", async () => {
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true });
    links.createShortLink.mockResolvedValue({ code: "example", id: "link_1" });
    const { createLinkFromFormData } = await import("@/app/admin/links/create-link");
    const formData = new FormData();
    formData.set("destinationUrl", "https://example.com");

    await expect(createLinkFromFormData(formData)).resolves.toMatchObject({ id: "link_1" });
    expect(links.createShortLink).toHaveBeenCalledWith(expect.objectContaining({
      createdById: "user_1",
      destinationUrl: "https://example.com"
    }));
  });

  it("returns a bookmarklet error without creating a link", async () => {
    const { createBookmarkletLinkAction } = await import("@/app/bookmarklet/actions");
    const formData = new FormData();
    formData.set("destinationUrl", "https://example.com");

    await expect(createBookmarkletLinkAction(formData)).rejects.toThrow(/Redirect: \/bookmarklet\?createError=/);
    expect(navigation.redirect).toHaveBeenCalledWith(expect.stringContaining("createError=Too+many+links+created"));
    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith("api:create:user_1", 60, 60_000);
    expect(links.createShortLink).not.toHaveBeenCalled();
  });
});
