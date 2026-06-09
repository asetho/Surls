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
  archiveShortLink,
  deleteArchivedShortLink,
  restoreShortLink,
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

  it("archives links by disabling and timestamping them", async () => {
    shortLink.update.mockResolvedValue({ id: "link_1", code: "demo" });
    await archiveShortLink("link_1");

    expect(shortLink.update).toHaveBeenCalledWith({
      where: { id: "link_1" },
      data: { archivedAt: expect.any(Date), enabled: false }
    });
  });

  it("restores archived links by clearing archivedAt and enabling them", async () => {
    shortLink.update.mockResolvedValue({ id: "link_1", code: "demo" });
    await restoreShortLink("link_1");

    expect(shortLink.update).toHaveBeenCalledWith({
      where: { id: "link_1" },
      data: { archivedAt: null, enabled: true }
    });
  });

  it("only permanently deletes archived links with matching code confirmation", async () => {
    shortLink.findUnique.mockResolvedValue({ id: "link_1", code: "demo", archivedAt: new Date() });
    await deleteArchivedShortLink("link_1", "demo");

    expect(shortLink.delete).toHaveBeenCalledWith({ where: { id: "link_1" } });
  });

  it("rejects permanent delete when the link is still active", async () => {
    shortLink.findUnique.mockResolvedValue({ id: "link_1", code: "demo", archivedAt: null });

    await expect(deleteArchivedShortLink("link_1", "demo")).rejects.toThrow(/archive this link/i);
    expect(shortLink.delete).not.toHaveBeenCalled();
  });
});
