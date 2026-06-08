import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export async function auditLog(input: {
  userId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  ipHash?: string | null;
  userAgent?: string | null;
  details?: Prisma.InputJsonValue;
}) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ipHash: input.ipHash,
      userAgent: input.userAgent,
      details: input.details
    }
  });
}
