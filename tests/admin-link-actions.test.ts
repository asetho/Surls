import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  isAdminUser: vi.fn((user: { role?: string } | null) => user?.role === "ADMIN"),
  requireAdmin: vi.fn(),
  requireSiteAdmin: vi.fn()
}));

const audit = vi.hoisted(() => ({ auditLog: vi.fn() }));
const csrf = vi.hoisted(() => ({ validateCsrf: vi.fn() }));
const nextCache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const navigation = vi.hoisted(() => ({ redirect: vi.fn() }));
const prisma = vi.hoisted(() => ({
  shortLink: { update: vi.fn() },
  user: { update: vi.fn() }
}));
const urlSafety = vi.hoisted(() => ({ assertNoPrivateResolution: vi.fn() }));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/csrf", () => csrf);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/link-lifecycle", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/link-lifecycle")>(),
  archiveShortLink: vi.fn(),
  deleteShortLink: vi.fn(),
  restoreShortLink: vi.fn()
}));
vi.mock("@/app/admin/links/create-link", () => ({ createLinkFromFormData: vi.fn() }));
vi.mock("next/cache", () => nextCache);
vi.mock("next/navigation", () => navigation);
vi.mock("@/lib/url-safety", async () => {
  const actual = await vi.importActual<typeof import("@/lib/url-safety")>("@/lib/url-safety");
  return { ...actual, assertNoPrivateResolution: urlSafety.assertNoPrivateResolution };
});

function updateForm(id: string) {
  const formData = new FormData();
  formData.set("csrf", "csrf-token");
  formData.set("id", id);
  formData.set("destinationUrl", "https://example.com/destination");
  formData.set("title", "Updated link");
  formData.set("tags", "Upload, Client Docs");
  formData.set("enabled", "on");
  return formData;
}

describe("link update authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAdmin.mockResolvedValue({ id: "user_123", role: "USER" });
    urlSafety.assertNoPrivateResolution.mockResolvedValue(undefined);
    prisma.shortLink.update.mockResolvedValue({ code: "owned-link", id: "link_123" });
  });

  it("scopes a non-admin update to the signed-in link owner", async () => {
    const { updateLinkAction } = await import("@/app/admin/links/actions");

    await updateLinkAction(updateForm("link_123"));

    expect(prisma.shortLink.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "link_123", createdById: "user_123" }
    }));
  });

  it("allows a site admin to update a link without an owner restriction", async () => {
    auth.requireAdmin.mockResolvedValue({ id: "admin_123", role: "ADMIN" });
    const { updateLinkAction } = await import("@/app/admin/links/actions");

    await updateLinkAction(updateForm("link_123"));

    expect(prisma.shortLink.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "link_123" }
    }));
  });

  it("replaces a link's tags with normalized tag relationships", async () => {
    const { updateLinkAction } = await import("@/app/admin/links/actions");

    await updateLinkAction(updateForm("link_123"));

    expect(prisma.shortLink.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tags: {
          deleteMany: {},
          create: [
            {
              tag: {
                connectOrCreate: {
                  where: { slug: "upload" },
                  create: { name: "Upload", slug: "upload" }
                }
              }
            },
            {
              tag: {
                connectOrCreate: {
                  where: { slug: "client-docs" },
                  create: { name: "Client Docs", slug: "client-docs" }
                }
              }
            }
          ]
        }
      })
    }));
  });

  it("rejects oversized destinations before resolution or persistence", async () => {
    const { updateLinkAction } = await import("@/app/admin/links/actions");
    const formData = updateForm("link_123");
    formData.set("destinationUrl", `https://example.com/${"x".repeat(4_100)}`);

    await expect(updateLinkAction(formData)).rejects.toThrow(/4096 characters or fewer/i);
    expect(urlSafety.assertNoPrivateResolution).not.toHaveBeenCalled();
    expect(prisma.shortLink.update).not.toHaveBeenCalled();
  });
});

describe("link list preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAdmin.mockResolvedValue({ id: "user_123", linkListPageSize: 20, role: "USER" });
    prisma.user.update.mockResolvedValue({ id: "user_123" });
  });

  it("persists the selected page size through a CSRF-protected action", async () => {
    const { filterLinksAction } = await import("@/app/admin/links/actions");
    const formData = new FormData();
    formData.set("csrf", "csrf-token");
    formData.set("pageSize", "75");
    formData.set("q", "client docs");
    formData.set("sort", "url_desc");
    formData.set("tag", "shared");
    formData.set("view", "archived");

    await filterLinksAction(formData);

    expect(csrf.validateCsrf).toHaveBeenCalledWith(formData);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_123" },
      data: { linkListPageSize: 75 }
    });
    expect(navigation.redirect).toHaveBeenCalledWith(
      "/admin/links?view=archived&q=client+docs&tag=shared&sort=url_desc&pageSize=75"
    );
  });
});
