import { beforeEach, describe, expect, it, vi } from "vitest";

const shortLink = vi.hoisted(() => ({
  delete: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { shortLink }
}));

import {
  DEFAULT_LINK_PAGE_SIZE,
  archiveShortLink,
  deleteShortLink,
  normalizeLinkListPage,
  normalizeLinkListPageSize,
  normalizeLinkListSort,
  normalizeLinkListTag,
  restoreShortLink,
  resolveLinkListPageSize,
  shortLinkListOrderBy,
  shortLinkListWhere
} from "@/lib/link-lifecycle";

describe("link lifecycle helpers", () => {
  beforeEach(() => {
    shortLink.delete.mockReset();
    shortLink.findUnique.mockReset();
    shortLink.update.mockReset();
  });

  it("uses active and archived list filters", () => {
    expect(shortLinkListWhere("active")).toEqual({ archivedAt: null });
    expect(shortLinkListWhere("archived")).toEqual({ archivedAt: { not: null } });
  });

  it("searches link fields and tag fields", () => {
    expect(shortLinkListWhere("active", "demo")).toEqual({
      archivedAt: null,
      OR: [
        { code: { contains: "demo", mode: "insensitive" } },
        { title: { contains: "demo", mode: "insensitive" } },
        { destinationUrl: { contains: "demo", mode: "insensitive" } },
        { tags: { some: { tag: { name: { contains: "demo", mode: "insensitive" } } } } },
        { tags: { some: { tag: { slug: { contains: "demo", mode: "insensitive" } } } } }
      ]
    });
  });

  it("filters links by tag slug", () => {
    expect(shortLinkListWhere("active", undefined, "product")).toEqual({
      archivedAt: null,
      tags: { some: { tag: { slug: "product" } } }
    });
  });

  it("normalizes list sort and returns matching order clauses", () => {
    expect(normalizeLinkListSort("clicks")).toBe("clicks_desc");
    expect(normalizeLinkListSort("created_asc")).toBe("created_asc");
    expect(normalizeLinkListSort("created_desc")).toBe("newest");
    expect(normalizeLinkListSort("url_asc")).toBe("url_asc");
    expect(normalizeLinkListSort("unknown")).toBe("newest");
    expect(shortLinkListOrderBy("created_asc")).toEqual([{ createdAt: "asc" }]);
    expect(shortLinkListOrderBy("url_asc")).toEqual([{ code: "asc" }, { createdAt: "desc" }]);
    expect(shortLinkListOrderBy("clicks_desc")).toEqual([{ clickCount: "desc" }, { createdAt: "desc" }]);
    expect(shortLinkListOrderBy("status_desc")).toEqual([{ enabled: "desc" }, { code: "asc" }]);
  });

  it("normalizes list pagination and tag filters", () => {
    expect(normalizeLinkListPage("3")).toBe(3);
    expect(normalizeLinkListPage("-2")).toBe(1);
    expect(normalizeLinkListPageSize("50")).toBe(50);
    expect(normalizeLinkListPageSize("500")).toBe(200);
    expect(normalizeLinkListPageSize("nope")).toBe(DEFAULT_LINK_PAGE_SIZE);
    expect(normalizeLinkListTag(" demo ")).toBe("demo");
    expect(normalizeLinkListTag(" ")).toBeUndefined();
  });

  it("resolves list page size from saved user preference unless a query value is present", () => {
    expect(resolveLinkListPageSize(undefined, 75)).toBe(75);
    expect(resolveLinkListPageSize(undefined, 500)).toBe(200);
    expect(resolveLinkListPageSize("50", 75)).toBe(50);
    expect(resolveLinkListPageSize("", 75)).toBe(DEFAULT_LINK_PAGE_SIZE);
  });

  it("archives links by disabling and timestamping them", async () => {
    shortLink.update.mockResolvedValue({ id: "link_1", code: "demo" });
    await archiveShortLink("link_1", { id: "user_1", role: "USER" });

    expect(shortLink.update).toHaveBeenCalledWith({
      where: { id: "link_1", createdById: "user_1" },
      data: { archivedAt: expect.any(Date), enabled: false }
    });
  });

  it("allows site admins to archive any link", async () => {
    shortLink.update.mockResolvedValue({ id: "link_1", code: "demo" });
    await archiveShortLink("link_1", { id: "admin_1", role: "ADMIN" });

    expect(shortLink.update).toHaveBeenCalledWith({
      where: { id: "link_1" },
      data: { archivedAt: expect.any(Date), enabled: false }
    });
  });

  it("restores archived links by clearing archivedAt and enabling them", async () => {
    shortLink.update.mockResolvedValue({ id: "link_1", code: "demo" });
    await restoreShortLink("link_1", { id: "user_1", role: "USER" });

    expect(shortLink.update).toHaveBeenCalledWith({
      where: { id: "link_1", createdById: "user_1" },
      data: { archivedAt: null, enabled: true }
    });
  });

  it("allows site admins to restore any link", async () => {
    shortLink.update.mockResolvedValue({ id: "link_1", code: "demo" });
    await restoreShortLink("link_1", { id: "admin_1", role: "ADMIN" });

    expect(shortLink.update).toHaveBeenCalledWith({
      where: { id: "link_1" },
      data: { archivedAt: null, enabled: true }
    });
  });

  it("permanently deletes links with matching code confirmation", async () => {
    shortLink.findUnique.mockResolvedValue({ id: "link_1", code: "demo" });
    await deleteShortLink("link_1", "/demo");

    expect(shortLink.delete).toHaveBeenCalledWith({ where: { id: "link_1" } });
  });

  it("accepts full short URL confirmation for permanent delete", async () => {
    shortLink.findUnique.mockResolvedValue({ id: "link_1", code: "demo" });
    await deleteShortLink("link_1", "http://localhost:3000/demo");

    expect(shortLink.delete).toHaveBeenCalledWith({ where: { id: "link_1" } });
  });

  it("accepts /s short URL confirmation for permanent delete", async () => {
    shortLink.findUnique.mockResolvedValue({ id: "link_1", code: "demo" });
    await deleteShortLink("link_1", "http://localhost:3000/s/demo");

    expect(shortLink.delete).toHaveBeenCalledWith({ where: { id: "link_1" } });
  });

  it("permanently deletes active links with matching code confirmation", async () => {
    shortLink.findUnique.mockResolvedValue({ id: "link_1", code: "demo" });
    await deleteShortLink("link_1", "/demo");

    expect(shortLink.delete).toHaveBeenCalledWith({ where: { id: "link_1" } });
  });

  it("rejects permanent delete when the confirmation does not match", async () => {
    shortLink.findUnique.mockResolvedValue({ id: "link_1", code: "demo" });

    await expect(deleteShortLink("link_1", "/not-demo")).rejects.toThrow(/type demo/i);
    expect(shortLink.delete).not.toHaveBeenCalled();
  });
});
