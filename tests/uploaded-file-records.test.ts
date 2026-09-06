import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  appSetting: {
    findUnique: vi.fn(),
    upsert: vi.fn()
  },
  uploadedFile: {
    aggregate: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn()
  },
  shortLink: {
    findFirst: vi.fn(),
    findMany: vi.fn()
  }
}));

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  appSetting: {
    findUnique: vi.fn()
  }
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

const uploads = vi.hoisted(() => ({
  deleteUploadedFile: vi.fn(),
  storedUploadsOnDisk: vi.fn(),
  uploadedFilenameFromDestination: vi.fn((destinationUrl: string) => destinationUrl.split("/uploads/")[1] ?? null),
  uploadedFileSize: vi.fn(),
  uploadedFileUrl: vi.fn((storageKey: string) => `http://localhost:3000/uploads/${storageKey}`)
}));

vi.mock("@/lib/uploads", () => uploads);

import {
  deleteUploadedFileWithRecord,
  ensureUploadedFileRecord,
  withUploadedFileReservation
} from "@/lib/uploaded-file-records";

describe("uploaded file quota reservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(transaction));
    prisma.appSetting.findUnique.mockResolvedValue({ key: "internal.uploadedFiles.reconciled.v1" });
    transaction.uploadedFile.aggregate.mockResolvedValue({ _sum: { sizeBytes: 0n } });
    transaction.uploadedFile.create.mockResolvedValue({ id: "upload_123" });
    transaction.uploadedFile.findMany.mockResolvedValue([]);
    transaction.shortLink.findMany.mockResolvedValue([]);
    transaction.appSetting.findUnique.mockResolvedValue(null);
    uploads.storedUploadsOnDisk.mockResolvedValue([]);
    uploads.uploadedFileSize.mockResolvedValue(50);
  });

  it("binds a legacy file record to its oldest remaining link owner", async () => {
    transaction.uploadedFile.findUnique.mockResolvedValue(null);
    transaction.shortLink.findFirst.mockResolvedValue({ createdById: "original_owner", id: "legacy_link" });
    transaction.uploadedFile.create.mockResolvedValue({
      downloadName: "legacy-report.pdf",
      ownerId: "original_owner",
      shortLinkId: "legacy_link"
    });

    await expect(ensureUploadedFileRecord("legacy-report.pdf")).resolves.toEqual({
      downloadName: "legacy-report.pdf",
      ownerId: "original_owner",
      shortLinkId: "legacy_link"
    });

    expect(transaction.shortLink.findFirst).toHaveBeenCalledWith({
      where: { destinationUrl: "http://localhost:3000/uploads/legacy-report.pdf" },
      orderBy: { createdAt: "asc" },
      select: { createdById: true, id: true }
    });
  });

  it("reconciles legacy files before calculating new storage quota", async () => {
    prisma.appSetting.findUnique.mockResolvedValue(null);
    uploads.storedUploadsOnDisk.mockResolvedValue([
      { sizeBytes: 50, storageKey: "legacy-report.pdf" }
    ]);
    transaction.shortLink.findMany.mockResolvedValue([
      { createdById: "user_legacy", destinationUrl: "http://localhost:3000/uploads/legacy-report.pdf", id: "legacy_link" }
    ]);
    const operation = vi.fn().mockResolvedValue({ result: "created", shortLinkId: "new_link" });

    await withUploadedFileReservation({
      downloadName: "New.pdf",
      ownerId: "user_123",
      sizeBytes: 1024,
      storageKey: "0123456789abcdef.pdf"
    }, operation);

    expect(transaction.uploadedFile.createMany).toHaveBeenCalledWith({
      data: [{
        downloadName: "legacy-report.pdf",
        ownerId: "user_legacy",
        shortLinkId: "legacy_link",
        sizeBytes: 50n,
        storageKey: "legacy-report.pdf"
      }],
      skipDuplicates: true
    });
    expect(transaction.uploadedFile.aggregate).toHaveBeenCalledTimes(2);
    expect(transaction.appSetting.upsert).toHaveBeenCalledWith({
      where: { key: "internal.uploadedFiles.reconciled.v1" },
      update: { value: true },
      create: { key: "internal.uploadedFiles.reconciled.v1", value: true }
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(transaction.appSetting.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.uploadedFile.aggregate.mock.invocationCallOrder[0]
    );
    expect(transaction.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      uploads.storedUploadsOnDisk.mock.invocationCallOrder[0]
    );
  });

  it("does not rescan stored uploads after legacy reconciliation completes", async () => {
    const operation = vi.fn().mockResolvedValue({ result: "created", shortLinkId: "new_link" });

    await withUploadedFileReservation({
      downloadName: "New.pdf",
      ownerId: "user_123",
      sizeBytes: 1024,
      storageKey: "0123456789abcdef.pdf"
    }, operation);

    expect(uploads.storedUploadsOnDisk).not.toHaveBeenCalled();
    expect(transaction.appSetting.findUnique).not.toHaveBeenCalled();
    expect(transaction.uploadedFile.findMany).not.toHaveBeenCalled();
    expect(transaction.appSetting.upsert).not.toHaveBeenCalled();
  });

  it("batches legacy metadata lookups during the one-time reconciliation", async () => {
    prisma.appSetting.findUnique.mockResolvedValue(null);
    uploads.storedUploadsOnDisk.mockResolvedValue(
      Array.from({ length: 501 }, (_, index) => ({ sizeBytes: 1, storageKey: `legacy-${index}.txt` }))
    );
    const operation = vi.fn().mockResolvedValue({ result: "created", shortLinkId: "new_link" });

    await withUploadedFileReservation({
      downloadName: "New.pdf",
      ownerId: "user_123",
      sizeBytes: 1024,
      storageKey: "0123456789abcdef.pdf"
    }, operation);

    expect(transaction.uploadedFile.findMany).toHaveBeenCalledTimes(2);
    expect(transaction.uploadedFile.findMany.mock.calls[0][0].where.storageKey.in).toHaveLength(500);
    expect(transaction.uploadedFile.findMany.mock.calls[1][0].where.storageKey.in).toHaveLength(1);
  });

  it("coordinates physical upload deletion with quota reconciliation", async () => {
    await deleteUploadedFileWithRecord("legacy-report.pdf");

    expect(transaction.uploadedFile.deleteMany).toHaveBeenCalledWith({
      where: { storageKey: "legacy-report.pdf" }
    });
    expect(uploads.deleteUploadedFile).toHaveBeenCalledWith("legacy-report.pdf");
    expect(transaction.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      uploads.deleteUploadedFile.mock.invocationCallOrder[0]
    );
  });

  it("serializes quota accounting and creates metadata in the caller transaction", async () => {
    const operation = vi.fn().mockResolvedValue({ result: "created", shortLinkId: "link_123" });

    await expect(withUploadedFileReservation({
      downloadName: "Report.pdf",
      ownerId: "user_123",
      sizeBytes: 1024,
      storageKey: "0123456789abcdef.pdf"
    }, operation)).resolves.toBe("created");

    expect(transaction.$executeRaw).toHaveBeenCalledOnce();
    expect(transaction.uploadedFile.create).toHaveBeenCalledWith({
      data: {
        downloadName: "Report.pdf",
        ownerId: "user_123",
        shortLinkId: "link_123",
        sizeBytes: 1024n,
        storageKey: "0123456789abcdef.pdf"
      }
    });
    expect(operation).toHaveBeenCalledWith(transaction);
  });

  it("rejects a reservation before file metadata or link creation when the user quota is exhausted", async () => {
    transaction.uploadedFile.aggregate
      .mockResolvedValueOnce({ _sum: { sizeBytes: 0n } })
      .mockResolvedValueOnce({ _sum: { sizeBytes: 1024n * 1024n * 1024n } });
    const operation = vi.fn();

    await expect(withUploadedFileReservation({
      downloadName: "Report.pdf",
      ownerId: "user_123",
      sizeBytes: 1,
      storageKey: "0123456789abcdef.pdf"
    }, operation)).rejects.toThrow(/quota/i);

    expect(transaction.uploadedFile.create).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
  });
});
