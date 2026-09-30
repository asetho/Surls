import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  backupCode: { findMany: vi.fn(), updateMany: vi.fn() }
}));
const verification = vi.hoisted(() => ({
  normalizeBackupCode: vi.fn((value: string) => value.trim().toUpperCase()),
  verifyBackupCode: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/backup-codes", () => verification);

describe("backup code proof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.backupCode.findMany.mockResolvedValue([{ id: "backup_1", codeHash: "hash_1" }]);
    db.backupCode.updateMany.mockResolvedValue({ count: 1 });
    verification.verifyBackupCode.mockResolvedValue(true);
  });

  it("only searches unused codes for a correctly shaped code", async () => {
    const { matchingBackupCodeId } = await import("@/lib/backup-code-proof");
    expect(await matchingBackupCodeId("user_1", "123456")).toBeNull();
    expect(db.backupCode.findMany).not.toHaveBeenCalled();
    expect(await matchingBackupCodeId("user_1", "abcde-fghjk")).toBe("backup_1");
    expect(db.backupCode.findMany).toHaveBeenCalledWith({
      where: { userId: "user_1", usedAt: null }, select: { id: true, codeHash: true }
    });
  });

  it("atomically refuses a code already consumed by another request", async () => {
    const { consumeBackupCode } = await import("@/lib/backup-code-proof");
    expect(await consumeBackupCode(db as never, "user_1", "backup_1")).toBe(true);
    db.backupCode.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await consumeBackupCode(db as never, "user_1", "backup_1")).toBe(false);
    expect(db.backupCode.updateMany).toHaveBeenCalledWith({
      where: { id: "backup_1", userId: "user_1", usedAt: null }, data: { usedAt: expect.any(Date) }
    });
  });
});
