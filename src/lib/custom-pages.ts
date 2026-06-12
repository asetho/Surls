import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { AppSettings, CustomHtmlPage } from "./settings";
import { env } from "./env";
import { splitLoginFormPlaceholder, validateLoginPageTemplate } from "./login-template";
export {
  LOGIN_FORM_PLACEHOLDER,
  LOGIN_TAGLINE_PLACEHOLDER,
  LOGIN_TITLE_PLACEHOLDER,
  parseLoginTemplate,
  renderLoginTemplateHtml,
  splitLoginFormPlaceholder,
  validateLoginPageTemplate
} from "./login-template";

export const CUSTOM_PAGE_MAX_BYTES = 256 * 1024;

export type CustomPageKind = "index" | "notFound" | "login";
export type FilesystemCustomPageKind = CustomPageKind;

export const FILESYSTEM_CUSTOM_PAGE_FILES: Record<FilesystemCustomPageKind, string> = {
  index: "index.html",
  notFound: "404.html",
  login: "login.html"
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

function escapeHtmlAttribute(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

export function addNonceToCustomPageScripts(html: string, nonce?: string | null) {
  const trimmedNonce = nonce?.trim();
  if (!trimmedNonce) return html;

  const nonceAttribute = escapeHtmlAttribute(trimmedNonce);
  return html.replace(/<script(?=[\s>])([^>]*)>/gi, (match, attributes: string) => {
    if (/\snonce\s*=/i.test(attributes)) return match;
    return `<script nonce="${nonceAttribute}"${attributes}>`;
  });
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
    if (kind === "login" && !splitLoginFormPlaceholder(html)) return null;
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
