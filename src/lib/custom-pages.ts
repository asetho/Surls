import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { AppSettings, CustomHtmlPage } from "./settings";
import { env } from "./env";

export const CUSTOM_PAGE_MAX_BYTES = 256 * 1024;
export const CUSTOM_PAGE_ASSET_MAX_BYTES = 5 * 1024 * 1024;
export const LOGIN_FORM_PLACEHOLDER = "{{LOGIN_FORM}}";

export type CustomPageKind = "index" | "notFound" | "login";
export type FilesystemCustomPageKind = Exclude<CustomPageKind, "login">;

export const FILESYSTEM_CUSTOM_PAGE_FILES: Record<FilesystemCustomPageKind, string> = {
  index: "index.html",
  notFound: "404.html"
};

const CUSTOM_PAGE_ASSET_CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

export const CUSTOM_PAGE_SETTINGS: Record<
  CustomPageKind,
  keyof Pick<AppSettings, "customIndexPage" | "customNotFoundPage" | "customLoginPage">
> = {
  index: "customIndexPage",
  notFound: "customNotFoundPage",
  login: "customLoginPage"
};

export function isCustomPageKind(value: unknown): value is CustomPageKind {
  return value === "index" || value === "notFound" || value === "login";
}

export function filesystemCustomPageLocation(kind: FilesystemCustomPageKind, rootDir = env.CUSTOM_PAGES_DIR) {
  return path.join(/*turbopackIgnore: true*/ rootDir, FILESYSTEM_CUSTOM_PAGE_FILES[kind]);
}

function safePathInside(rootDir: string, parts: string[]) {
  const root = path.resolve(/*turbopackIgnore: true*/ rootDir);
  const target = path.resolve(/*turbopackIgnore: true*/ root, ...parts);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return target;
}

async function readFileStats(filePath: string, maxBytes: number) {
  const fileStats = await stat(/*turbopackIgnore: true*/ filePath);
  if (!fileStats.isFile() || fileStats.size === 0 || fileStats.size > maxBytes) return null;
  return fileStats;
}

export async function pageFromFilesystem(
  kind: FilesystemCustomPageKind,
  rootDir = env.CUSTOM_PAGES_DIR
): Promise<CustomHtmlPage | null> {
  const root = rootDir.trim();
  if (!root) return null;

  const fileName = FILESYSTEM_CUSTOM_PAGE_FILES[kind];
  const filePath = safePathInside(root, [fileName]);
  if (!filePath) return null;

  try {
    const fileStats = await readFileStats(filePath, CUSTOM_PAGE_MAX_BYTES);
    if (!fileStats) return null;
    const html = (await readFile(/*turbopackIgnore: true*/ filePath, "utf8")).trim();
    if (!html) return null;
    return {
      fileName,
      html,
      size: fileStats.size,
      updatedAt: fileStats.mtime.toISOString()
    };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : "";
    if (code === "ENOENT" || code === "ENOTDIR" || code === "EACCES") return null;
    throw error;
  }
}

export async function assetFromFilesystem(pathSegments: string[], rootDir = env.CUSTOM_PAGES_DIR) {
  const root = rootDir.trim();
  if (!root || !pathSegments.length) return null;
  if (pathSegments.some((segment) => !segment || segment === "." || segment === ".." || segment.startsWith("."))) {
    return null;
  }

  const filePath = safePathInside(root, ["assets", ...pathSegments]);
  if (!filePath) return null;

  const contentType = CUSTOM_PAGE_ASSET_CONTENT_TYPES[path.extname(filePath).toLowerCase()];
  if (!contentType) return null;

  try {
    const fileStats = await readFileStats(filePath, CUSTOM_PAGE_ASSET_MAX_BYTES);
    if (!fileStats) return null;
    return {
      body: await readFile(/*turbopackIgnore: true*/ filePath),
      contentType,
      size: fileStats.size,
      updatedAt: fileStats.mtime
    };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : "";
    if (code === "ENOENT" || code === "ENOTDIR" || code === "EACCES") return null;
    throw error;
  }
}

export function normalizeCustomHtmlPage(value: unknown): CustomHtmlPage | null {
  if (!value || typeof value !== "object") return null;
  const page = value as Partial<CustomHtmlPage>;
  const html = typeof page.html === "string" ? page.html : "";
  if (!html.trim()) return null;
  return {
    fileName: typeof page.fileName === "string" && page.fileName.trim() ? page.fileName.trim() : "custom.html",
    html,
    size: typeof page.size === "number" && Number.isFinite(page.size) ? page.size : new TextEncoder().encode(html).byteLength,
    updatedAt: typeof page.updatedAt === "string" ? page.updatedAt : new Date(0).toISOString()
  };
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
      typeof value === "object" &&
      "arrayBuffer" in value &&
      typeof value.arrayBuffer === "function" &&
      "name" in value &&
      "size" in value
  );
}

export function splitLoginFormPlaceholder(html: string) {
  const parts = html.split(LOGIN_FORM_PLACEHOLDER);
  return parts.length === 2 ? { before: parts[0], after: parts[1] } : null;
}

export function validateLoginPageTemplate(html: string) {
  if (!splitLoginFormPlaceholder(html)) {
    throw new Error(`Custom login pages must include exactly one ${LOGIN_FORM_PLACEHOLDER} placeholder.`);
  }
}

export async function pageFromUpload(
  value: FormDataEntryValue | null,
  options: { requireLoginPlaceholder?: boolean } = {}
): Promise<CustomHtmlPage> {
  if (!isFileLike(value) || value.size === 0) {
    throw new Error("Upload an HTML file.");
  }

  const fileName = value.name.trim() || "custom.html";
  if (!/\.(html|htm)$/i.test(fileName)) {
    throw new Error("Upload a .html or .htm file.");
  }

  if (value.size > CUSTOM_PAGE_MAX_BYTES) {
    throw new Error("Custom pages must be 256 KB or smaller.");
  }

  const html = new TextDecoder("utf-8").decode(await value.arrayBuffer()).trim();
  if (!html) {
    throw new Error("Uploaded HTML file is empty.");
  }
  if (options.requireLoginPlaceholder) {
    validateLoginPageTemplate(html);
  }

  return {
    fileName,
    html,
    size: value.size,
    updatedAt: new Date().toISOString()
  };
}
