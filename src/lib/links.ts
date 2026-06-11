import { Prisma } from "@prisma/client";
import { generateAlias, validateAlias } from "./alias";
import { fetchPageTitle } from "./page-title";
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
  fetchTitle?: boolean;
};

type ShortLinkClient = Pick<Prisma.TransactionClient, "shortLink">;

export function shortUrl(baseUrl: string, code: string) {
  return `${baseUrl.replace(/\/$/, "")}/${code}`;
}

export function normalizeOptionalDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error("Enter a valid expiration date.");
    return value;
  }
  const text = String(value).trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid expiration date.");
  return date;
}

export function normalizeOptionalPositiveInt(value: unknown, label = "Value") {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value).trim(), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive whole number.`);
  return parsed;
}

function tagSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function normalizeShortLinkTags(tags: string[] | undefined) {
  const seen = new Set<string>();
  return (tags ?? [])
    .map((tagName) => tagName.trim())
    .filter(Boolean)
    .map((name) => {
      const slug = tagSlug(name);
      if (!slug) throw new Error(`Tag "${name}" must include at least one letter or number.`);
      if (slug.length > 80) throw new Error(`Tag "${name}" is too long.`);
      return { name, slug };
    })
    .filter((tag) => {
      if (seen.has(tag.slug)) return false;
      seen.add(tag.slug);
      return true;
    });
}

export async function createShortLink(input: CreateShortLinkInput, db: ShortLinkClient = prisma) {
  const safeUrl = parseSafeHttpUrl(input.destinationUrl);
  if (!safeUrl.ok) {
    throw new Error(safeUrl.error);
  }

  const expiresAt = normalizeOptionalDate(input.expiresAt);
  const maxClicks = normalizeOptionalPositiveInt(input.maxClicks, "Max clicks");
  const tags = normalizeShortLinkTags(input.tags);
  let code = input.code?.trim() || generateAlias();
  let attempts = 0;
  while (!input.code && attempts < 8) {
    const exists = await db.shortLink.findUnique({ where: { code } });
    if (!exists) break;
    code = generateAlias();
    attempts += 1;
  }

  const aliasError = validateAlias(code);
  if (aliasError) throw new Error(aliasError);

  const title = input.title?.trim() || (input.fetchTitle === false ? null : await fetchPageTitle(safeUrl.url));

  try {
    const link = await db.shortLink.create({
      data: {
        code,
        destinationUrl: safeUrl.url,
        title,
        description: input.description?.trim() || null,
        notes: input.notes?.trim() || null,
        enabled: input.enabled ?? true,
        expiresAt,
        maxClicks,
        createdById: input.createdById,
        tags: tags.length
          ? {
              create: tags.map(({ name, slug }) => {
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
