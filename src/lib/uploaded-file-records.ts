import type { Prisma } from "@prisma/client";
import { env } from "./env";
import { prisma } from "./prisma";

type UploadedFileReservation = {
  downloadName: string;
  ownerId: string;
  sizeBytes: number;
  storageKey: string;
};

const UPLOAD_QUOTA_LOCK_ID = 2_047_815_303;

function quotaLabel(bytes: number) {
  const gibibytes = bytes / (1024 * 1024 * 1024);
  return Number.isInteger(gibibytes) ? `${gibibytes} GB` : `${Math.floor(bytes / (1024 * 1024))} MB`;
}

export async function withUploadedFileReservation<T>(
  input: UploadedFileReservation,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>
) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(${UPLOAD_QUOTA_LOCK_ID})`;
    const [siteUsage, userUsage] = await Promise.all([
      transaction.uploadedFile.aggregate({ _sum: { sizeBytes: true } }),
      transaction.uploadedFile.aggregate({
        where: { ownerId: input.ownerId },
        _sum: { sizeBytes: true }
      })
    ]);
    const siteBytes = siteUsage._sum.sizeBytes ?? 0n;
    const userBytes = userUsage._sum.sizeBytes ?? 0n;
    const nextSize = BigInt(input.sizeBytes);

    if (userBytes + nextSize > BigInt(env.UPLOAD_USER_STORAGE_QUOTA_BYTES)) {
      throw new Error(`Your stored uploads have reached the ${quotaLabel(env.UPLOAD_USER_STORAGE_QUOTA_BYTES)} quota.`);
    }
    if (siteBytes + nextSize > BigInt(env.UPLOAD_SITE_STORAGE_QUOTA_BYTES)) {
      throw new Error(`Stored uploads have reached the site ${quotaLabel(env.UPLOAD_SITE_STORAGE_QUOTA_BYTES)} quota.`);
    }

    await transaction.uploadedFile.create({
      data: {
        downloadName: input.downloadName,
        ownerId: input.ownerId,
        sizeBytes: nextSize,
        storageKey: input.storageKey
      }
    });
    return operation(transaction);
  });
}

export async function uploadedFileDownloadName(storageKey: string) {
  const uploadedFile = await prisma.uploadedFile.findUnique({
    where: { storageKey },
    select: { downloadName: true }
  });
  return uploadedFile?.downloadName ?? null;
}

export async function deleteUploadedFileRecord(storageKey: string) {
  await prisma.uploadedFile.deleteMany({ where: { storageKey } });
}
