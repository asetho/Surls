import { randomBytes } from "node:crypto";
import { link, mkdir, open, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { appBaseUrl, env } from "./env";
import { UPLOAD_PROCESS_MAX_BYTES } from "./upload-limits";

export const UPLOAD_ROUTE_SEGMENT = "uploads";
export const UPLOAD_FILENAME_MODES = ["original", "safe", "random"] as const;

export type UploadFilenameMode = (typeof UPLOAD_FILENAME_MODES)[number];

type StoreUploadedFileOptions = {
  dropExtension?: boolean;
  filenameMode?: UploadFilenameMode;
  maxBytes?: number | null;
};

export type StoredUpload = {
  downloadName: string;
  filename: string;
  filePath: string;
  pendingFilePath: string;
  publicPath: string;
  size: number;
};

const MAX_FILENAME_LENGTH = 180;

function randomSuffix(bytes = 5) {
  return randomBytes(bytes).toString("hex");
}

export function uploadMaxBytes() {
  return env.UPLOAD_MAX_BYTES;
}

export function uploadMaxBytesLabel(bytes: number | null = uploadMaxBytes()) {
  if (bytes === null) return "No limit";
  if (bytes >= 1024 * 1024) return `${Math.floor(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.floor(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

export function normalizeUploadFilenameMode(value: FormDataEntryValue | null): UploadFilenameMode {
  return UPLOAD_FILENAME_MODES.includes(value as UploadFilenameMode) ? (value as UploadFilenameMode) : "safe";
}

function uploadsRoot() {
  const root = env.UPLOADS_DIR.trim();
  if (!path.isAbsolute(root)) {
    throw new Error("UPLOADS_DIR must be an absolute path.");
  }
  return path.normalize(root);
}

function pendingUploadsRoot(root: string) {
  return path.join(root, ".pending");
}

function removePathParts(filename: string) {
  return filename.replace(/\\/g, "/").split("/").pop() ?? "";
}

function sanitizedOriginalName(filename: string) {
  const cleaned = removePathParts(filename)
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "upload";
}

function browserSafePart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[-_.]+|[-_.]+$/g, "");
}

function limitedName(base: string, extension: string) {
  const maxBaseLength = Math.max(1, MAX_FILENAME_LENGTH - extension.length);
  return `${base.slice(0, maxBaseLength)}${extension}`;
}

export function storedUploadFilename(
  originalName: string,
  options: StoreUploadedFileOptions = {}
) {
  const safeOriginal = sanitizedOriginalName(originalName);
  const originalExtension = path.extname(safeOriginal).slice(0, 20);
  const extension = options.dropExtension ? "" : originalExtension;
  return limitedName(randomSuffix(16), extension);
}

function uploadedDownloadName(
  originalName: string,
  storageFilename: string,
  options: StoreUploadedFileOptions
) {
  if (options.filenameMode === "random") return storageFilename;
  const safeOriginal = sanitizedOriginalName(originalName);
  const originalExtension = path.extname(safeOriginal).slice(0, 20);
  const extension = options.dropExtension ? "" : originalExtension;
  const baseName = safeOriginal.slice(0, originalExtension ? -originalExtension.length : undefined);
  if (options.filenameMode === "original") {
    return limitedName(baseName.trim() || "upload", extension);
  }
  return limitedName(browserSafePart(baseName) || "upload", extension);
}

export function uploadContentDisposition(filename: string | null) {
  if (!filename) return "attachment";
  const safeFilename = sanitizedOriginalName(filename);
  const fallback = browserSafePart(safeFilename) || "download";
  const encoded = encodeURIComponent(safeFilename).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function filePathInside(root: string, filename: string) {
  const target = path.resolve(root, filename);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Upload filename resolves outside the upload directory.");
  }
  return target;
}

export function uploadedFileUrl(filename: string) {
  return new URL(`/${UPLOAD_ROUTE_SEGMENT}/${encodeURIComponent(filename)}`, `${appBaseUrl()}/`).toString();
}

export function uploadedFilenameFromDestination(destinationUrl: string) {
  try {
    const destination = new URL(destinationUrl);
    const base = new URL(appBaseUrl());
    if (destination.origin !== base.origin) return null;

    const prefix = `/${UPLOAD_ROUTE_SEGMENT}/`;
    if (!destination.pathname.startsWith(prefix)) return null;
    const encodedFilename = destination.pathname.slice(prefix.length);
    if (!encodedFilename || encodedFilename.includes("/")) return null;

    const filename = decodeURIComponent(encodedFilename);
    if (!filename || filename.includes("/") || filename.includes("\\")) return null;
    return filename;
  } catch {
    return null;
  }
}

async function writeUniqueFile(root: string, filename: string, file: File) {
  const extension = path.extname(filename);
  const baseName = filename.slice(0, extension ? -extension.length : undefined);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = attempt === 0 ? filename : limitedName(`${baseName}-${randomSuffix(3)}`, extension);
    const filePath = filePathInside(root, candidate);
    let handle;
    try {
      handle = await open(filePath, "wx");
      await handle.writeFile(file.stream());
      return { filename: candidate, filePath };
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : "";
      if (code !== "EEXIST") throw error;
    } finally {
      await handle?.close();
    }
  }

  throw new Error("Could not find an unused upload filename.");
}

export async function storeUploadedFile(file: File, options: StoreUploadedFileOptions = {}): Promise<StoredUpload> {
  if (!file.name.trim()) throw new Error("Choose a file to upload.");
  if (file.size < 1) throw new Error("Choose a non-empty file to upload.");
  const configuredMaxBytes = options.maxBytes === undefined ? uploadMaxBytes() : options.maxBytes;
  const maxBytes = configuredMaxBytes === null
    ? UPLOAD_PROCESS_MAX_BYTES
    : Math.min(configuredMaxBytes, UPLOAD_PROCESS_MAX_BYTES);
  if (file.size > maxBytes) {
    throw new Error(`Upload files up to ${uploadMaxBytesLabel(maxBytes)} at a time.`);
  }

  const root = uploadsRoot();
  const pendingRoot = pendingUploadsRoot(root);
  await Promise.all([mkdir(root, { recursive: true }), mkdir(pendingRoot, { recursive: true })]);
  const filename = storedUploadFilename(file.name, options);
  const pending = await writeUniqueFile(pendingRoot, filename, file);
  const filePath = filePathInside(root, pending.filename);
  const publicPath = `/${UPLOAD_ROUTE_SEGMENT}/${encodeURIComponent(pending.filename)}`;

  return {
    downloadName: uploadedDownloadName(file.name, pending.filename, options),
    filename: pending.filename,
    filePath,
    pendingFilePath: pending.filePath,
    publicPath,
    size: file.size
  };
}

export async function promoteUploadedFile(upload: StoredUpload) {
  await link(upload.pendingFilePath, upload.filePath);
  await rm(upload.pendingFilePath, { force: true });
}

export async function discardUploadedFile(upload: StoredUpload) {
  await Promise.all([
    rm(upload.pendingFilePath, { force: true }),
    rm(upload.filePath, { force: true })
  ]);
}

export async function deleteUploadedFile(filename: string) {
  await rm(filePathInside(uploadsRoot(), filename), { force: true });
}

export async function uploadedFileSize(filename: string) {
  try {
    const fileStats = await stat(filePathInside(uploadsRoot(), filename));
    return fileStats.isFile() ? fileStats.size : null;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : "";
    if (code === "ENOENT") return null;
    throw error;
  }
}

export async function storedUploadsOnDisk() {
  const root = uploadsRoot();
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : "";
    if (code === "ENOENT") return [];
    throw error;
  }

  const files = await Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => ({
    sizeBytes: (await stat(filePathInside(root, entry.name))).size,
    storageKey: entry.name
  })));
  return files;
}
