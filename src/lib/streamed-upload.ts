import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import busboy from "busboy";
import { env } from "./env";
import { uploadFileFromPath, uploadMaxBytesLabel, type UploadFile } from "./uploads";

export const UPLOAD_MULTIPART_OVERHEAD_BYTES = 64 * 1024;
export const UPLOAD_BODY_TIMEOUT_MS = 120_000;
const UPLOAD_TOTAL_TIMEOUT_MS = 60 * 60 * 1000;
const STALE_INCOMING_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ALLOWED_FIELDS = new Set(["code", "dropExtension", "filenameMode", "title"]);

async function removeStaleIncomingFiles(root: string) {
  const entries = await readdir(root, { withFileTypes: true });
  const cutoff = Date.now() - STALE_INCOMING_MAX_AGE_MS;
  await Promise.allSettled(entries.filter((entry) => entry.isFile()).slice(0, 100).map(async (entry) => {
    const filePath = path.join(root, entry.name);
    if ((await stat(filePath)).mtimeMs < cutoff) await rm(filePath, { force: true });
  }));
}

export class UploadParseError extends Error {
  constructor(message: string, readonly status: 400 | 408 | 413 | 415) {
    super(message);
  }
}

export class UploadStorageError extends Error {
  constructor() {
    super("Could not save upload.");
  }
}

export type StreamedUpload = {
  fields: Map<string, string>;
  file: UploadFile;
  cleanup: () => Promise<void>;
};

export async function parseStreamedUpload(request: Request, uploadMaxBytes: number | null): Promise<StreamedUpload> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new UploadParseError("Content-Type must be multipart/form-data", 415);
  }
  if (!request.body) throw new UploadParseError("Invalid multipart form data", 400);

  // An unlimited per-file policy still cannot exceed the configured storage quotas.
  const quotaMaxBytes = Math.min(env.UPLOAD_USER_STORAGE_QUOTA_BYTES, env.UPLOAD_SITE_STORAGE_QUOTA_BYTES);
  const maxFileBytes = Math.min(uploadMaxBytes ?? quotaMaxBytes, quotaMaxBytes);
  const maxRequestBytes = maxFileBytes + UPLOAD_MULTIPART_OVERHEAD_BYTES;
  const contentLength = Number(request.headers.get("content-length"));
  const tooLarge = () => new UploadParseError(
    uploadMaxBytes !== null && uploadMaxBytes <= quotaMaxBytes
      ? `Upload files up to ${uploadMaxBytesLabel(uploadMaxBytes)} at a time.`
      : "The file exceeds the available upload storage quota.",
    413
  );
  if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) throw tooLarge();

  if (!path.isAbsolute(env.UPLOADS_DIR)) throw new Error("UPLOADS_DIR must be an absolute path.");
  const incomingRoot = path.join(env.UPLOADS_DIR, ".incoming");
  const filePath = path.join(incomingRoot, randomUUID());
  const cleanup = () => rm(filePath, { force: true });
  const fields = new Map<string, string>();
  let filename: string | null = null;
  let fileSize = 0;
  const fileWrites: Promise<void>[] = [];
  let fileSeen = false;
  let writeError: unknown = null;
  let parseError: UploadParseError | null = null;
  let timedOut = false;
  let bytesRead = 0;

  const parser = busboy({
    headers: { "content-type": contentType },
    limits: { fieldNameSize: 64, fieldSize: 4096, fields: 4, files: 1, headerPairs: 32, parts: 5, fileSize: maxFileBytes + 1 }
  });
  const reject = (message: string) => {
    parseError ??= new UploadParseError(message, 400);
    parser.destroy(parseError);
  };
  parser.on("field", (name, value, info) => {
    if (!ALLOWED_FIELDS.has(name) || fields.has(name) || info.nameTruncated || info.valueTruncated) {
      reject("Invalid multipart form data");
    } else {
      fields.set(name, value);
    }
  });
  parser.on("file", (name, stream, info) => {
    if (name !== "file" || filename !== null) {
      reject("Choose a file to upload.");
      stream.resume();
      return;
    }
    filename = info.filename ?? "";
    fileSeen = true;
    fileWrites.push(pipeline(
      stream,
      new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          fileSize += chunk.length;
          if (fileSize > maxFileBytes) callback(tooLarge());
          else callback(null, chunk);
        }
      }),
      createWriteStream(filePath, { flags: "wx", mode: 0o600 })
    ).catch((error: unknown) => {
      writeError = error;
      parser.destroy(error instanceof Error ? error : new Error("Could not save upload."));
    }));
  });
  for (const event of ["fieldsLimit", "filesLimit", "partsLimit"] as const) {
    parser.on(event, () => reject("Invalid multipart form data"));
  }

  const source = Readable.fromWeb(request.body as import("node:stream/web").ReadableStream<Uint8Array>);
  // The idle timer may fire while the upload directory is being prepared.
  source.on("error", () => undefined);
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const totalTimer = setTimeout(() => {
    timedOut = true;
    source.destroy(new Error("Upload request timed out."));
  }, UPLOAD_TOTAL_TIMEOUT_MS);
  totalTimer.unref();
  const resetIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      timedOut = true;
      source.destroy(new Error("Upload request timed out."));
    }, UPLOAD_BODY_TIMEOUT_MS);
    idleTimer.unref();
  };
  resetIdleTimer();
  try {
    await mkdir(incomingRoot, { recursive: true }).catch(() => { throw new UploadStorageError(); });
    await removeStaleIncomingFiles(incomingRoot).catch(() => undefined);
    await pipeline(source, new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        resetIdleTimer();
        bytesRead += chunk.length;
        if (bytesRead > maxRequestBytes) callback(tooLarge());
        else callback(null, chunk);
      }
    }), parser);
    await Promise.all(fileWrites);
    if (writeError) throw writeError;
    if (parseError) throw parseError;
    if (!filename || !fileSeen || fileSize < 1) throw new UploadParseError("Choose a non-empty file to upload.", 400);
    return { fields, file: uploadFileFromPath(filePath, filename, fileSize), cleanup };
  } catch (error) {
    await Promise.allSettled(fileWrites);
    await cleanup().catch(() => undefined);
    if (timedOut) throw new UploadParseError("Upload request timed out. Please try again.", 408);
    if (error instanceof UploadParseError || error instanceof UploadStorageError) throw error;
    if (writeError) throw new UploadStorageError();
    throw new UploadParseError("Invalid multipart form data", 400);
  } finally {
    clearTimeout(idleTimer);
    clearTimeout(totalTimer);
  }
}
