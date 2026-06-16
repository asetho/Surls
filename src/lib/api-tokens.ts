import { prisma } from "./prisma";
import { hashToken, randomToken } from "./crypto";
import { env } from "./env";

export const API_TOKEN_SCOPE_LINKS_CREATE = "links:create";

function defaultApiTokenExpiresAt(now = new Date()) {
  return new Date(now.getTime() + env.API_TOKEN_DAYS * 24 * 60 * 60 * 1000);
}

function normalizeScopes(scopes: string[] | undefined) {
  const cleaned = Array.from(new Set((scopes?.length ? scopes : [API_TOKEN_SCOPE_LINKS_CREATE]).map((scope) => scope.trim()).filter(Boolean)));
  return cleaned.includes(API_TOKEN_SCOPE_LINKS_CREATE) ? cleaned : [API_TOKEN_SCOPE_LINKS_CREATE];
}

export function tokenHasScope(scopes: string | null | undefined, requiredScope: string) {
  return String(scopes ?? "")
    .split(",")
    .map((scope) => scope.trim())
    .includes(requiredScope);
}

export function createPlainApiToken() {
  return `surls_${randomToken(32)}`;
}

export async function createApiToken(
  userId: string,
  name: string,
  options: { expiresAt?: Date | null; scopes?: string[] } = {}
) {
  const token = createPlainApiToken();
  const tokenPrefix = token.slice(0, 12);
  const scopes = normalizeScopes(options.scopes);
  const row = await prisma.apiToken.create({
    data: {
      userId,
      name,
      scopes: scopes.join(","),
      expiresAt: options.expiresAt === undefined ? defaultApiTokenExpiresAt() : options.expiresAt,
      tokenPrefix,
      tokenHash: hashToken(token)
    }
  });
  return { row, token };
}

export async function authenticateApiToken(header: string | null, requiredScope?: string) {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const row = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });
  if (!row || row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt <= new Date()) return null;
  if (requiredScope && !tokenHasScope(row.scopes, requiredScope)) return null;
  await prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  return row;
}
