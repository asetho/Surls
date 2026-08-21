import { getSiteUploadMaxBytes } from "./settings";

export const BYTES_PER_MEGABYTE = 1024 * 1024;
export const MAX_UPLOAD_MEGABYTES = 1024;

export type UploadLimitUser = {
  uploadLimitUnlimited?: boolean | null;
  uploadMaxBytes?: bigint | number | null;
};

export type UserUploadLimitMode = "default" | "custom" | "unlimited";

export function uploadMegabytesToBytes(value: FormDataEntryValue | null, label = "Upload limit") {
  const megabytes = Number(String(value ?? "").trim());
  if (!Number.isSafeInteger(megabytes) || megabytes < 1 || megabytes > MAX_UPLOAD_MEGABYTES) {
    throw new Error(`${label} must be a whole number from 1 to ${MAX_UPLOAD_MEGABYTES} MB.`);
  }
  return megabytes * BYTES_PER_MEGABYTE;
}

export function uploadBytesToMegabytes(value: bigint | number | null | undefined) {
  if (value === null || value === undefined) return null;
  return Math.max(1, Math.round(Number(value) / BYTES_PER_MEGABYTE));
}

export function userUploadLimitMode(user: UploadLimitUser): UserUploadLimitMode {
  if (user.uploadLimitUnlimited) return "unlimited";
  return user.uploadMaxBytes === null || user.uploadMaxBytes === undefined ? "default" : "custom";
}

export function userUploadLimitFromFormData(formData: FormData) {
  const mode = String(formData.get("uploadLimitMode") ?? "default") as UserUploadLimitMode;
  if (mode === "unlimited") {
    return { uploadLimitUnlimited: true, uploadMaxBytes: null };
  }
  if (mode === "custom") {
    return {
      uploadLimitUnlimited: false,
      uploadMaxBytes: BigInt(uploadMegabytesToBytes(formData.get("uploadMaxMegabytes"), "User upload limit"))
    };
  }
  if (mode !== "default") throw new Error("Choose a valid user upload limit.");
  return { uploadLimitUnlimited: false, uploadMaxBytes: null };
}

export function siteUploadLimitFromFormData(formData: FormData) {
  const mode = String(formData.get("siteUploadLimitMode") ?? "limited");
  if (mode === "unlimited") return null;
  if (mode !== "limited") throw new Error("Choose a valid site upload limit.");
  return uploadMegabytesToBytes(formData.get("siteUploadMaxMegabytes"), "Site upload limit");
}

export function effectiveUploadMaxBytes(user: UploadLimitUser, siteUploadMaxBytes: number | null) {
  if (user.uploadLimitUnlimited) return null;
  if (user.uploadMaxBytes !== null && user.uploadMaxBytes !== undefined) {
    return Number(user.uploadMaxBytes);
  }
  return siteUploadMaxBytes;
}

export async function getEffectiveUploadMaxBytes(user: UploadLimitUser) {
  return effectiveUploadMaxBytes(user, await getSiteUploadMaxBytes());
}
