import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type LinkListView = "active" | "archived";

export function normalizeLinkListView(value: unknown): LinkListView {
  return value === "archived" ? "archived" : "active";
}

export function shortLinkListWhere(view: LinkListView, query?: string): Prisma.ShortLinkWhereInput {
  const q = query?.trim();
  return {
    archivedAt: view === "archived" ? { not: null } : null,
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { title: { contains: q, mode: "insensitive" } },
            { destinationUrl: { contains: q, mode: "insensitive" } }
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
