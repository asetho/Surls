import { signValue, verifySignedValue } from "./crypto";
import { prisma } from "./prisma";
import { uploadedFilenameFromDestination, uploadedFileUrl } from "./uploads";

export const UPLOAD_GRANT_QUERY_PARAM = "_surls_download";
export const UPLOAD_GRANT_TTL_MS = 30 * 1000;

type UploadGrantMethod = "GET" | "HEAD";

type UploadGrantPayload = {
  expiresAt: number;
  filename: string;
  linkId: string;
  method: UploadGrantMethod;
};

function encodeGrant(payload: UploadGrantPayload) {
  return signValue(Buffer.from(JSON.stringify(payload), "utf8").toString("base64url"));
}

function decodeGrant(value: string | null, now: Date) {
  if (!value || value.length > 2048) return null;
  const encoded = verifySignedValue(value);
  if (!encoded) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<UploadGrantPayload>;
    if (
      typeof payload.expiresAt !== "number" ||
      !Number.isSafeInteger(payload.expiresAt) ||
      payload.expiresAt <= now.getTime() ||
      payload.expiresAt > now.getTime() + UPLOAD_GRANT_TTL_MS ||
      typeof payload.filename !== "string" ||
      !payload.filename ||
      payload.filename.includes("/") ||
      payload.filename.includes("\\") ||
      typeof payload.linkId !== "string" ||
      !payload.linkId ||
      (payload.method !== "GET" && payload.method !== "HEAD")
    ) {
      return null;
    }
    return payload as UploadGrantPayload;
  } catch {
    return null;
  }
}

export function grantUploadDownloadUrl(
  destinationUrl: string,
  linkId: string,
  method: UploadGrantMethod,
  now = new Date()
) {
  const filename = uploadedFilenameFromDestination(destinationUrl);
  if (!filename) return destinationUrl;

  const destination = new URL(destinationUrl);
  destination.searchParams.set(
    UPLOAD_GRANT_QUERY_PARAM,
    encodeGrant({
      expiresAt: now.getTime() + UPLOAD_GRANT_TTL_MS,
      filename,
      linkId,
      method
    })
  );
  return destination.toString();
}

export async function hasValidUploadDownloadGrant(
  request: Request,
  filename: string,
  method: UploadGrantMethod,
  now = new Date()
) {
  const payload = decodeGrant(new URL(request.url).searchParams.get(UPLOAD_GRANT_QUERY_PARAM), now);
  if (!payload || payload.filename !== filename || payload.method !== method) return false;

  const link = await prisma.shortLink.findUnique({
    where: { id: payload.linkId },
    select: {
      archivedAt: true,
      clickCount: true,
      destinationUrl: true,
      enabled: true,
      expiresAt: true,
      maxClicks: true
    }
  });
  if (!link || !link.enabled || link.archivedAt || (link.expiresAt && link.expiresAt <= now)) return false;
  if (link.maxClicks !== null && link.clickCount > link.maxClicks) return false;
  return link.destinationUrl === uploadedFileUrl(filename);
}
