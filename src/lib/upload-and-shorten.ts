import { AuditAction } from "@prisma/client";
import { auditLog } from "./audit";
import { appBaseUrl } from "./env";
import { validateAlias } from "./alias";
import { createShortLink, shortUrl } from "./links";
import { prisma } from "./prisma";
import {
  deleteUploadedFile,
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
  title?: string | null;
  via: "api-upload" | "upload";
};

async function trustedSafeResolution() {
  return true;
}

export async function uploadAndShortenFile(input: UploadAndShortenInput) {
  const code = input.code?.trim() || null;
  if (code) {
    const aliasError = validateAlias(code);
    if (aliasError) throw new Error(aliasError);
    const existing = await prisma.shortLink.findUnique({ where: { code }, select: { id: true } });
    if (existing) throw new Error("That short alias is already in use.");
  }

  let stored: Awaited<ReturnType<typeof storeUploadedFile>> | null = null;
  try {
    stored = await storeUploadedFile(input.file, {
      dropExtension: input.dropExtension,
      filenameMode: input.filenameMode
    });
    const fileUrl = new URL(stored.publicPath, `${appBaseUrl()}/`).toString();
    const link = await createShortLink(
      {
        destinationUrl: fileUrl,
        code,
        tags: ["Upload"],
        title: input.title?.trim() || input.file.name,
        createdById: input.createdById,
        createdByApiTokenName: input.createdByApiTokenName,
        createdByApiTokenPrefix: input.createdByApiTokenPrefix,
        fetchTitle: false
      },
      prisma,
      {
        allowPrivateDestination: true,
        assertSafeResolution: trustedSafeResolution
      }
    );

    await auditLog({
      userId: input.createdById,
      action: AuditAction.SHORT_LINK_CREATED,
      entityType: "ShortLink",
      entityId: link.id,
      details: {
        code: link.code,
        filename: stored.filename,
        originalName: input.file.name,
        via: input.via,
        size: stored.size
      }
    });

    return {
      code: link.code,
      filename: stored.filename,
      fileUrl,
      shortUrl: shortUrl(appBaseUrl(), link.code)
    };
  } catch (error) {
    if (stored) await deleteUploadedFile(stored.filename).catch(() => null);
    throw error;
  }
}
