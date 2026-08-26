import type { Prisma } from "@prisma/client";
import { env } from "./env";
import { prisma } from "./prisma";
import {
  storedUploadsOnDisk,
  uploadedFilenameFromDestination,
  uploadedFileSize,
  uploadedFileUrl
} from "./uploads";

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

async function reconcileStoredUploads(
  transaction: Prisma.TransactionClient,
  files: Array<{ sizeBytes: number; storageKey: string }>,
  excludedStorageKey?: string
) {
  const candidates = files.filter((file) => file.storageKey !== excludedStorageKey);
  if (!candidates.length) return;
  const existing = await transaction.uploadedFile.findMany({
    where: { storageKey: { in: candidates.map((file) => file.storageKey) } },
    select: { storageKey: true }
  });
  const existingKeys = new Set(existing.map((file) => file.storageKey));
  const missing = candidates.filter((file) => !existingKeys.has(file.storageKey));
  if (!missing.length) return;

  const ownerByStorageKey = new Map<string, string | null>();
  const links = await transaction.shortLink.findMany({
    where: { destinationUrl: { contains: "/uploads/" } },
    orderBy: { createdAt: "asc" },
    select: { createdById: true, destinationUrl: true }
  });
  for (const link of links) {
    const storageKey = uploadedFilenameFromDestination(link.destinationUrl);
    if (storageKey && !ownerByStorageKey.has(storageKey)) {
      ownerByStorageKey.set(storageKey, link.createdById);
    }
  }

  for (let index = 0; index < missing.length; index += 500) {
    await transaction.uploadedFile.createMany({
      data: missing.slice(index, index + 500).map((file) => ({
        downloadName: file.storageKey,
        ownerId: ownerByStorageKey.get(file.storageKey) ?? null,
        sizeBytes: BigInt(file.sizeBytes),
        storageKey: file.storageKey
      })),
      skipDuplicates: true
    });
  }
}

export async function withUploadedFileReservation<T>(
  input: UploadedFileReservation,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>
) {
  const filesOnDisk = await storedUploadsOnDisk();
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(${UPLOAD_QUOTA_LOCK_ID})`;
    await reconcileStoredUploads(transaction, filesOnDisk, input.storageKey);
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

export async function ensureUploadedFileRecord(storageKey: string) {
  const sizeBytes = await uploadedFileSize(storageKey);
  if (sizeBytes === null) return null;

  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(${UPLOAD_QUOTA_LOCK_ID})`;
    const existing = await transaction.uploadedFile.findUnique({
      where: { storageKey },
      select: { downloadName: true, ownerId: true }
    });
    if (existing) return existing;

    const originalLink = await transaction.shortLink.findFirst({
      where: { destinationUrl: uploadedFileUrl(storageKey) },
      orderBy: { createdAt: "asc" },
      select: { createdById: true }
    });
    return transaction.uploadedFile.create({
      data: {
        downloadName: storageKey,
        ownerId: originalLink?.createdById ?? null,
        sizeBytes: BigInt(sizeBytes),
        storageKey
      },
      select: { downloadName: true, ownerId: true }
    });
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
