import { prisma } from "./prisma";
import { hashToken, randomToken } from "./crypto";

export function createPlainApiToken() {
  return `surls_${randomToken(32)}`;
}

export async function createApiToken(userId: string, name: string) {
  const token = createPlainApiToken();
  const tokenPrefix = token.slice(0, 12);
  const row = await prisma.apiToken.create({
    data: {
      userId,
      name,
      tokenPrefix,
      tokenHash: hashToken(token)
    }
  });
  return { row, token };
}

export async function authenticateApiToken(header: string | null) {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const row = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });
  if (!row || row.revokedAt) return null;
  await prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  return row;
}
