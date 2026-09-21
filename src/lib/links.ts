import { Prisma } from "@prisma/client";
import { generateAlias, validateAlias } from "./alias";
import { fetchPageTitle } from "./page-title";
import { assertNoPrivateResolution, parseSafeHttpUrl } from "./url-safety";
import { prisma } from "./prisma";
import { checkRateLimit } from "./rate-limit";

const DESTINATION_URL_MAX_LENGTH = 4_096;
const SHORT_LINK_TITLE_MAX_LENGTH = 240;
const SHORT_LINK_DESCRIPTION_MAX_LENGTH = 4_000;
const SHORT_LINK_NOTES_MAX_LENGTH = 8_000;
const TOKEN_SOURCE_NAME_MAX_LENGTH = 120;
const TOKEN_SOURCE_PREFIX_MAX_LENGTH = 32;

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
  createdByApiTokenName?: string | null;
  createdByApiTokenPrefix?: string | null;
  fetchTitle?: boolean;
};

type ShortLinkClient = Pick<Prisma.TransactionClient, "shortLink">;

type CreateShortLinkOptions = {
  allowPrivateDestination?: boolean;
  assertSafeResolution?: typeof assertNoPrivateResolution;
};

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
  const supplied = tags ?? [];
  if (supplied.length > 100 || supplied.reduce((total, tag) => total + tag.length, 0) > 8_000) {
    throw new Error("Too many tags.");
  }
  const seen = new Set<string>();
  return supplied
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

function normalizeBoundedOptionalText(value: unknown, label: string, maxLength: number) {
  const text = String(value ?? "").trim();
  if (text.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return text || null;
}

export function normalizeShortLinkTextFields(input: {
  title?: unknown;
  description?: unknown;
  notes?: unknown;
  createdByApiTokenName?: unknown;
  createdByApiTokenPrefix?: unknown;
}) {
  return {
    title: normalizeBoundedOptionalText(input.title, "Title", SHORT_LINK_TITLE_MAX_LENGTH),
    description: normalizeBoundedOptionalText(input.description, "Description", SHORT_LINK_DESCRIPTION_MAX_LENGTH),
    notes: normalizeBoundedOptionalText(input.notes, "Notes", SHORT_LINK_NOTES_MAX_LENGTH),
    createdByApiTokenName: normalizeBoundedOptionalText(input.createdByApiTokenName, "API token name", TOKEN_SOURCE_NAME_MAX_LENGTH),
    createdByApiTokenPrefix: normalizeBoundedOptionalText(input.createdByApiTokenPrefix, "API token prefix", TOKEN_SOURCE_PREFIX_MAX_LENGTH)
  };
}

export function normalizeShortLinkDestinationUrl(value: unknown) {
  const destinationUrl = String(value ?? "").trim();
  if (destinationUrl.length > DESTINATION_URL_MAX_LENGTH) {
    throw new Error(`Destination URL must be ${DESTINATION_URL_MAX_LENGTH} characters or fewer.`);
  }
  return destinationUrl;
}

export async function createShortLink(
  input: CreateShortLinkInput,
  db: ShortLinkClient = prisma,
  options: CreateShortLinkOptions = {}
) {
  const destinationUrl = normalizeShortLinkDestinationUrl(input.destinationUrl);
  const safeUrl = parseSafeHttpUrl(destinationUrl, options.allowPrivateDestination);
  if (!safeUrl.ok) {
    throw new Error(safeUrl.error);
  }
  await (options.assertSafeResolution ?? ((url) => assertNoPrivateResolution(url, options.allowPrivateDestination)))(safeUrl.url);

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

  const text = normalizeShortLinkTextFields(input);
  let title = text.title;
  if (!title && input.fetchTitle !== false) {
    const titleFetchAllowed = !input.createdById
      || (await checkRateLimit(`link:title-fetch:${input.createdById}`, 20, 60 * 1000)).allowed;
    if (titleFetchAllowed) {
      title = normalizeBoundedOptionalText(await fetchPageTitle(safeUrl.url), "Title", SHORT_LINK_TITLE_MAX_LENGTH);
    }
  }

  try {
    const link = await db.shortLink.create({
      data: {
        code,
        destinationUrl: safeUrl.url,
        title,
        description: text.description,
        notes: text.notes,
        enabled: input.enabled ?? true,
        expiresAt,
        maxClicks,
        createdById: input.createdById,
        createdByApiTokenName: text.createdByApiTokenName,
        createdByApiTokenPrefix: text.createdByApiTokenPrefix,
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
