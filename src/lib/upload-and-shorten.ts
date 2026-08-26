import { AuditAction } from "@prisma/client";
import { appBaseUrl } from "./env";
import { validateAlias } from "./alias";
import { createShortLink, shortUrl } from "./links";
import { prisma } from "./prisma";
import { withUploadedFileReservation } from "./uploaded-file-records";
import {
  discardUploadedFile,
  promoteUploadedFile,
  type UploadFilenameMode,
  storeUploadedFile
} from "./uploads";

type UploadAndShortenInput = {
  code?: string | null;
  createdByApiTokenName?: string | null;
  createdByApiTokenPrefix?: string | null;
  createdById: string;
  dropExtension?: boolean;
  file: File;
  filenameMode: UploadFilenameMode;
  uploadMaxBytes?: number | null;
  title?: string | null;
  via: "api-upload" | "upload";
};

async function trustedSafeResolution() {
  return true;
}

export async function checkUploadShortCodeAvailability(value: string) {
  const code = value.trim();
  const aliasError = validateAlias(code);
  if (aliasError) return { available: false, error: aliasError };

  const existing = await prisma.shortLink.findUnique({ where: { code }, select: { id: true } });
  return existing
    ? { available: false, error: "That short alias is already in use." }
    : { available: true, error: null };
}

export async function uploadAndShortenFile(input: UploadAndShortenInput) {
  const code = input.code?.trim() || null;
  const title = input.title?.trim() || input.file.name;
  if (title.length > 240) throw new Error("Title must be 240 characters or fewer.");
  if (code) {
    const availability = await checkUploadShortCodeAvailability(code);
    if (!availability.available) throw new Error(availability.error ?? "That short alias is unavailable.");
  }

  let stored: Awaited<ReturnType<typeof storeUploadedFile>> | null = null;
  try {
    stored = await storeUploadedFile(input.file, {
      dropExtension: input.dropExtension,
      filenameMode: input.filenameMode,
      maxBytes: input.uploadMaxBytes
    });
    const storedFile = stored;
    const fileUrl = new URL(storedFile.publicPath, `${appBaseUrl()}/`).toString();
    const link = await withUploadedFileReservation(
      {
        downloadName: storedFile.downloadName,
        finalize: () => promoteUploadedFile(storedFile),
        ownerId: input.createdById,
        sizeBytes: storedFile.size,
        storageKey: storedFile.filename
      },
      async (transaction) => {
        const createdLink = await createShortLink(
          {
            destinationUrl: fileUrl,
            code,
            tags: ["Upload"],
            title,
            createdById: input.createdById,
            createdByApiTokenName: input.createdByApiTokenName,
            createdByApiTokenPrefix: input.createdByApiTokenPrefix,
            fetchTitle: false
          },
          transaction,
          {
            allowPrivateDestination: true,
            assertSafeResolution: trustedSafeResolution
          }
        );
        await transaction.auditLog.create({
          data: {
            userId: input.createdById,
            action: AuditAction.SHORT_LINK_CREATED,
            entityType: "ShortLink",
            entityId: createdLink.id,
            details: {
              code: createdLink.code,
              filename: storedFile.downloadName,
              originalName: input.file.name,
              storageKey: storedFile.filename,
              via: input.via,
              size: storedFile.size
            }
          }
        });
        return { result: createdLink, shortLinkId: createdLink.id };
      }
    );

    return {
      code: link.code,
      filename: storedFile.downloadName,
      shortUrl: shortUrl(appBaseUrl(), link.code)
    };
  } catch (error) {
    if (stored) await discardUploadedFile(stored).catch(() => null);
    throw error;
  }
}
