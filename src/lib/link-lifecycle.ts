import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type LinkListView = "active" | "archived";
export type LinkListSort =
  | "newest"
  | "url_asc"
  | "url_desc"
  | "clicks_desc"
  | "clicks_asc"
  | "status_asc"
  | "status_desc";

export const DEFAULT_LINK_PAGE_SIZE = 20;
const MAX_LINK_PAGE_SIZE = 200;

export function normalizeLinkListView(value: unknown): LinkListView {
  return value === "archived" ? "archived" : "active";
}

export function normalizeLinkListSort(value: unknown): LinkListSort {
  switch (value) {
    case "url_asc":
    case "url_desc":
    case "clicks_desc":
    case "clicks_asc":
    case "status_asc":
    case "status_desc":
      return value;
    case "clicks":
      return "clicks_desc";
    default:
      return "newest";
  }
}

export function normalizeLinkListPage(value: unknown) {
  const page = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function normalizeLinkListPageSize(value: unknown) {
  const pageSize = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(pageSize) || pageSize <= 0) return DEFAULT_LINK_PAGE_SIZE;
  return Math.min(pageSize, MAX_LINK_PAGE_SIZE);
}

export function normalizeLinkListTag(value: unknown) {
  const tag = String(value ?? "").trim();
  return tag || undefined;
}

export function shortLinkListOrderBy(sort: LinkListSort): Prisma.ShortLinkOrderByWithRelationInput[] {
  switch (sort) {
    case "url_asc":
      return [{ code: "asc" }, { createdAt: "desc" }];
    case "url_desc":
      return [{ code: "desc" }, { createdAt: "desc" }];
    case "clicks_asc":
      return [{ clickCount: "asc" }, { createdAt: "desc" }];
    case "clicks_desc":
      return [{ clickCount: "desc" }, { createdAt: "desc" }];
    case "status_asc":
      return [{ enabled: "asc" }, { code: "asc" }];
    case "status_desc":
      return [{ enabled: "desc" }, { code: "asc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }];
  }
}

export function shortLinkListWhere(view: LinkListView, query?: string, tagSlug?: string): Prisma.ShortLinkWhereInput {
  const q = query?.trim();
  return {
    archivedAt: view === "archived" ? { not: null } : null,
    ...(tagSlug ? { tags: { some: { tag: { slug: tagSlug } } } } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { title: { contains: q, mode: "insensitive" } },
            { destinationUrl: { contains: q, mode: "insensitive" } },
            { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
            { tags: { some: { tag: { slug: { contains: q, mode: "insensitive" } } } } }
          ]
        }
      : {})
  };
}

export async function archiveShortLink(id: string) {
  return prisma.shortLink.update({
    where: { id },
    data: { archivedAt: new Date(), enabled: false }
  });
}

export async function restoreShortLink(id: string) {
  return prisma.shortLink.update({
    where: { id },
    data: { archivedAt: null, enabled: true }
  });
}

function confirmedCode(value: FormDataEntryValue | string | null) {
  return String(value ?? "")
    .trim()
    .replace(/^\//, "");
}

export async function deleteArchivedShortLink(id: string, confirmation: FormDataEntryValue | string | null) {
  const link = await prisma.shortLink.findUnique({
    where: { id },
    select: { id: true, code: true, archivedAt: true }
  });

  if (!link) throw new Error("Short link not found.");
  if (!link.archivedAt) throw new Error("Archive this link before deleting it permanently.");
  if (confirmedCode(confirmation) !== link.code) throw new Error(`Type ${link.code} to permanently delete this link.`);

  await prisma.shortLink.delete({ where: { id } });
  return link;
}
