import { beforeEach, describe, expect, it, vi } from "vitest";

const auditLogModel = vi.hoisted(() => ({
  deleteMany: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { auditLog: auditLogModel }
}));

import { AUDIT_LOG_RETENTION_DAYS, auditLogRetentionCutoff, purgeExpiredAuditLogs } from "@/lib/audit";

beforeEach(() => {
  auditLogModel.deleteMany.mockReset();
});

describe("audit log retention", () => {
  it("uses a configurable audit log retention cutoff", () => {
    expect(AUDIT_LOG_RETENTION_DAYS).toBe(365);
    expect(auditLogRetentionCutoff(new Date("2026-06-11T12:00:00.000Z")).toISOString()).toBe(
      "2025-06-11T12:00:00.000Z"
    );
  });

  it("purges audit logs older than the retention window", async () => {
    auditLogModel.deleteMany.mockResolvedValue({ count: 3 });

    await expect(purgeExpiredAuditLogs(new Date("2026-06-11T12:00:00.000Z"))).resolves.toEqual({ count: 3 });
    expect(auditLogModel.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: new Date("2025-06-11T12:00:00.000Z") }
      }
    });
  });
});
