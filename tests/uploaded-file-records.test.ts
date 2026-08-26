import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  uploadedFile: {
    aggregate: vi.fn(),
    create: vi.fn()
  }
}));

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

import { withUploadedFileReservation } from "@/lib/uploaded-file-records";

describe("uploaded file quota reservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(transaction));
    transaction.uploadedFile.aggregate.mockResolvedValue({ _sum: { sizeBytes: 0n } });
    transaction.uploadedFile.create.mockResolvedValue({ id: "upload_123" });
  });

  it("serializes quota accounting and creates metadata in the caller transaction", async () => {
    const operation = vi.fn().mockResolvedValue("created");

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
