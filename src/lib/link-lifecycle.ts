import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { uploadedFilenameFromDestination } from "./uploads";
import { deleteUploadedFileWithRecord, ensureUploadedFileRecord } from "./uploaded-file-records";

export type LinkListView = "active" | "archived";
export type LinkListSort =
  | "newest"
  | "created_asc"
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
    case "created_asc":
    case "url_asc":
    case "url_desc":
    case "clicks_desc":
    case "clicks_asc":
    case "status_asc":
    case "status_desc":
      return value;
    case "created_desc":
      return "newest";
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

export function resolveLinkListPageSize(value: unknown, savedValue: unknown = DEFAULT_LINK_PAGE_SIZE) {
  return value === undefined ? normalizeLinkListPageSize(savedValue) : normalizeLinkListPageSize(value);
}

export function normalizeLinkListTag(value: unknown) {
  const tag = String(value ?? "").trim();
  return tag || undefined;
}

export function shortLinkListOrderBy(sort: LinkListSort): Prisma.ShortLinkOrderByWithRelationInput[] {
  switch (sort) {
    case "created_asc":
      return [{ createdAt: "asc" }];
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

export function shortLinkListWhere(
  view: LinkListView,
  query?: string,
  tagSlug?: string,
  createdById?: string
): Prisma.ShortLinkWhereInput {
  const q = query?.trim();
  return {
    archivedAt: view === "archived" ? { not: null } : null,
    ...(createdById ? { createdById } : {}),
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

export type LinkMutationActor = {
  id: string;
  role: string;
};

function linkMutationWhere(id: string, actor: LinkMutationActor): Prisma.ShortLinkWhereUniqueInput {
  return actor.role === "ADMIN" ? { id } : { id, createdById: actor.id };
}

export async function archiveShortLink(id: string, actor: LinkMutationActor) {
  return prisma.shortLink.update({
    where: linkMutationWhere(id, actor),
    data: { archivedAt: new Date(), enabled: false }
  });
}

export async function restoreShortLink(id: string, actor: LinkMutationActor) {
  return prisma.shortLink.update({
    where: linkMutationWhere(id, actor),
    data: { archivedAt: null, enabled: true }
  });
}

function confirmedCode(value: FormDataEntryValue | string | null) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  let code: string;
  try {
    const url = new URL(text);
    code = url.pathname.replace(/^\/+/, "");
  } catch {
    code = text.replace(/^\/+/, "");
  }
  const trimmed = code.replace(/\/+$/, "");
  return trimmed.startsWith("s/") ? trimmed.slice(2) : trimmed;
}

export async function deleteShortLink(id: string, confirmation: FormDataEntryValue | string | null) {
  const link = await prisma.shortLink.findUnique({
    where: { id },
    select: { code: true, destinationUrl: true, id: true }
  });

  if (!link) throw new Error("Short link not found.");
  if (confirmedCode(confirmation) !== link.code) throw new Error(`Type ${link.code} to permanently delete this link.`);

  const uploadedFilename = uploadedFilenameFromDestination(link.destinationUrl);
  const uploadedFileRecord = uploadedFilename
    ? await ensureUploadedFileRecord(uploadedFilename)
    : null;
  await prisma.shortLink.delete({ where: { id } });

  if (uploadedFilename) {
    if (uploadedFileRecord?.shortLinkId === id) {
      await deleteUploadedFileWithRecord(uploadedFilename);
      return link;
    }
    const remainingLink = await prisma.shortLink.findFirst({
      where: { destinationUrl: link.destinationUrl },
      select: { id: true }
    });
    if (!remainingLink) {
      await deleteUploadedFileWithRecord(uploadedFilename);
    }
  }

  return link;
}

export const deleteArchivedShortLink = deleteShortLink;
