import type { AuditAction, Prisma } from "@prisma/client";
import { env } from "./env";
import { prisma } from "./prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
const AUDIT_LOG_PURGE_INTERVAL_MS = DAY_MS;
export const AUDIT_LOG_RETENTION_DAYS = env.AUDIT_LOG_RETENTION_DAYS;

let lastAuditLogPurgeAt = 0;
let auditLogPurgeInterval: ReturnType<typeof setInterval> | null = null;

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

export function auditLogRetentionCutoff(now = new Date()) {
  return new Date(now.getTime() - AUDIT_LOG_RETENTION_DAYS * DAY_MS);
}

export async function purgeExpiredAuditLogs(now = new Date()) {
  return prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: auditLogRetentionCutoff(now) }
    }
  });
}

async function purgeExpiredAuditLogsOnce(now = new Date()) {
  if (now.getTime() - lastAuditLogPurgeAt < AUDIT_LOG_PURGE_INTERVAL_MS) return;
  lastAuditLogPurgeAt = now.getTime();
  await purgeExpiredAuditLogs(now);
}

export function startAuditLogPurgeSchedule() {
  if (auditLogPurgeInterval) return;
  void purgeExpiredAuditLogsOnce().catch(() => null);
  auditLogPurgeInterval = setInterval(() => {
    void purgeExpiredAuditLogsOnce().catch(() => null);
  }, AUDIT_LOG_PURGE_INTERVAL_MS);
  (auditLogPurgeInterval as { unref?: () => void }).unref?.();
}
