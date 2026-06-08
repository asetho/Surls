import { Prisma } from "@prisma/client";
import { generateAlias, validateAlias } from "./alias";
import { parseSafeHttpUrl } from "./url-safety";
import { prisma } from "./prisma";

export type CreateShortLinkInput = {
  destinationUrl: string;
  code?: string | null;
  title?: string | null;
  description?: string | null;
  notes?: string | null;
  enabled?: boolean;
  expiresAt?: Date | null;
  maxClicks?: number | null;
  tags?: string[];
  createdById?: string | null;
};

export function shortUrl(baseUrl: string, code: string) {
  return `${baseUrl.replace(/\/$/, "")}/${code}`;
}

export async function createShortLink(input: CreateShortLinkInput) {
  const safeUrl = parseSafeHttpUrl(input.destinationUrl);
  if (!safeUrl.ok) {
    throw new Error(safeUrl.error);
  }

  let code = input.code?.trim() || generateAlias();
  let attempts = 0;
  while (!input.code && attempts < 8) {
    const exists = await prisma.shortLink.findUnique({ where: { code } });
    if (!exists) break;
    code = generateAlias();
    attempts += 1;
  }

  const aliasError = validateAlias(code);
  if (aliasError) throw new Error(aliasError);

  try {
    const link = await prisma.shortLink.create({
      data: {
        code,
        destinationUrl: safeUrl.url,
        title: input.title?.trim() || null,
        description: input.description?.trim() || null,
        notes: input.notes?.trim() || null,
        enabled: input.enabled ?? true,
        expiresAt: input.expiresAt,
        maxClicks: input.maxClicks,
        createdById: input.createdById,
        tags: input.tags?.length
          ? {
              create: input.tags.map((tagName) => {
                const name = tagName.trim();
                const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                return {
                  tag: {
                    connectOrCreate: {
                      where: { slug },
                      create: { name, slug }
                    }
                  }
                };
              })
            }
          : undefined
      },
      include: { tags: { include: { tag: true } } }
    });
    return link;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("That short alias is already in use.");
    }
    throw error;
  }
}

export function linkUnavailableReason(link: {
  enabled: boolean;
  archivedAt: Date | null;
  expiresAt: Date | null;
  maxClicks: number | null;
  clickCount: number;
}) {
  if (link.archivedAt) return "This short URL has been archived.";
  if (!link.enabled) return "This short URL is disabled.";
  if (link.expiresAt && link.expiresAt <= new Date()) return "This short URL has expired.";
  if (link.maxClicks !== null && link.clickCount >= link.maxClicks) return "This short URL has reached its click limit.";
  return null;
}
