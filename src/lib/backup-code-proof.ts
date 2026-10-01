import type { Prisma } from "@prisma/client";
import { normalizeBackupCode, verifyBackupCode } from "./backup-codes";
import { prisma } from "./prisma";

const BACKUP_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/;

export async function matchingBackupCodeId(userId: string, code: string) {
  const normalized = normalizeBackupCode(code);
  if (!BACKUP_CODE_PATTERN.test(normalized)) return null;
  const unused = await prisma.backupCode.findMany({
    where: { userId, usedAt: null }, select: { id: true, codeHash: true }
  });
  for (const backup of unused) {
    if (await verifyBackupCode(backup.codeHash, normalized)) return backup.id;
  }
  return null;
}

export async function consumeBackupCode(tx: Prisma.TransactionClient, userId: string, codeId: string) {
  const result = await tx.backupCode.updateMany({
    where: { id: codeId, userId, usedAt: null }, data: { usedAt: new Date() }
  });
  return result.count === 1;
}
