import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
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
  $transaction: vi.fn()
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
    transaction.uploadedFile.aggregate.mockResolvedValue({ _sum: { sizeBytes: 0n } });
    transaction.uploadedFile.create.mockResolvedValue({ id: "upload_123" });
    transaction.uploadedFile.findMany.mockResolvedValue([]);
    transaction.shortLink.findMany.mockResolvedValue([]);
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
    expect(transaction.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      uploads.storedUploadsOnDisk.mock.invocationCallOrder[0]
    );
  });

  it("coordinates physical upload deletion with quota reconciliation", async () => {
    await deleteUploadedFileWithRecord("legacy-report.pdf");

    expect(transaction.uploadedFile.deleteMany).toHaveBeenCalledWith({
      where: { storageKey: "legacy-report.pdf" }
    });
    expect(uploads.deleteUploadedFile).toHaveBeenCalledWith("legacy-report.pdf");
    expect(transaction.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
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

    expect(transaction.$queryRaw).toHaveBeenCalledOnce();
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
