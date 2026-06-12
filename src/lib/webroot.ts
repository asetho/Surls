import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { env } from "./env";

const PUBLIC_WEBROOT_INDEX = "index.html";
const PUBLIC_WEBROOT_NOT_FOUND = "404.html";
const RESERVED_PUBLIC_WEBROOT_FILES = new Set(["login.html"]);

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".otf": "font/otf",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8"
};

export type PublicWebrootFile = {
  contentType: string;
  filePath: string;
  size: number;
  updatedAt: Date;
};

type PublicWebrootOptions = {
  allowReservedPath?: boolean;
  cacheControl?: string;
  method?: string;
  rootDir?: string;
  status?: number;
};

function normalizedWebrootRoot(rootDir: string) {
  const root = rootDir.trim();
  if (!root || !path.isAbsolute(root)) return null;
  return path.normalize(root);
}

export function publicWebrootLocation(rootDir = env.PUBLIC_WEBROOT_DIR) {
  return normalizedWebrootRoot(rootDir) ?? rootDir;
}

function contentTypeFor(filePath: string) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function validWebrootSegments(segments: string[]) {
  if (segments.length === 0) return true;

  return segments.every((segment, index) => {
    if (!segment || segment === "." || segment === ".." || segment.includes("/") || segment.includes("\\") || segment.includes("\0")) {
      return false;
    }
    if (segment.startsWith(".") && !(index === 0 && segment === ".well-known")) return false;
    return true;
  });
}

function safePathInside(rootDir: string, parts: string[]) {
  const root = normalizedWebrootRoot(rootDir);
  if (!root) return null;
  const target = path.resolve(/* turbopackIgnore: true */ root, ...parts);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return target;
}

function isReservedPublicWebrootPath(segments: string[]) {
  return segments.length === 1 && RESERVED_PUBLIC_WEBROOT_FILES.has(segments[0].toLowerCase());
}

export function isBlockedPublicWebrootPath(segments: string[]) {
  return !validWebrootSegments(segments) || isReservedPublicWebrootPath(segments);
}

async function fileInfo(filePath: string): Promise<PublicWebrootFile | null> {
  try {
    const fileStats = await stat(/* turbopackIgnore: true */ filePath);
    if (!fileStats.isFile()) return null;
    return {
      contentType: contentTypeFor(filePath),
      filePath,
      size: fileStats.size,
      updatedAt: fileStats.mtime
    };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : "";
    if (code === "ENOENT" || code === "ENOTDIR" || code === "EACCES") return null;
    throw error;
  }
}

export async function publicWebrootFile(
  pathSegments: string[],
  options: Pick<PublicWebrootOptions, "allowReservedPath" | "rootDir"> = {}
) {
  const rootDir = options.rootDir ?? env.PUBLIC_WEBROOT_DIR;
  if (!normalizedWebrootRoot(rootDir) || !validWebrootSegments(pathSegments)) return null;
  if (!options.allowReservedPath && isReservedPublicWebrootPath(pathSegments)) return null;

  const parts = pathSegments.length ? pathSegments : [PUBLIC_WEBROOT_INDEX];
  const requestedPath = safePathInside(rootDir, parts);
  if (!requestedPath) return null;

  try {
    const requestedStats = await stat(/* turbopackIgnore: true */ requestedPath);
    if (requestedStats.isFile()) {
      return {
        contentType: contentTypeFor(requestedPath),
        filePath: requestedPath,
        size: requestedStats.size,
        updatedAt: requestedStats.mtime
      };
    }
    if (!requestedStats.isDirectory()) return null;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : "";
    if (code === "ENOENT" || code === "ENOTDIR" || code === "EACCES") return null;
    throw error;
  }

  const indexPath = safePathInside(rootDir, [...parts, PUBLIC_WEBROOT_INDEX]);
  return indexPath ? fileInfo(indexPath) : null;
}

export async function publicWebrootResponse(pathSegments: string[], options: PublicWebrootOptions = {}) {
  const file = await publicWebrootFile(pathSegments, options);
  if (!file) return null;

  const headers = {
    "Cache-Control": options.cacheControl ?? "public, max-age=300",
    "Content-Length": String(file.size),
    "Content-Type": file.contentType,
    "Last-Modified": file.updatedAt.toUTCString(),
    "X-Content-Type-Options": "nosniff"
  };

  if (options.method?.toUpperCase() === "HEAD") {
    return new Response(null, { headers, status: options.status ?? 200 });
  }

  return new Response(Readable.toWeb(createReadStream(/* turbopackIgnore: true */ file.filePath)) as ReadableStream, {
    headers,
    status: options.status ?? 200
  });
}

export async function publicWebrootNotFoundResponse(options: Pick<PublicWebrootOptions, "method" | "rootDir"> = {}) {
  return (
    (await publicWebrootResponse([PUBLIC_WEBROOT_NOT_FOUND], {
      ...options,
      allowReservedPath: true,
      cacheControl: "no-store",
      status: 404
    })) ??
    new Response(options.method?.toUpperCase() === "HEAD" ? null : "Not found", {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff"
      },
      status: 404
    })
  );
}
