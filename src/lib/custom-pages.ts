import type { AppSettings, CustomHtmlPage } from "./settings";

export const CUSTOM_PAGE_MAX_BYTES = 256 * 1024;

export type CustomPageKind = "index" | "notFound";

export const CUSTOM_PAGE_SETTINGS: Record<CustomPageKind, keyof Pick<AppSettings, "customIndexPage" | "customNotFoundPage">> = {
  index: "customIndexPage",
  notFound: "customNotFoundPage"
};

export function isCustomPageKind(value: unknown): value is CustomPageKind {
  return value === "index" || value === "notFound";
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

export async function pageFromUpload(value: FormDataEntryValue | null): Promise<CustomHtmlPage> {
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

  return {
    fileName,
    html,
    size: value.size,
    updatedAt: new Date().toISOString()
  };
}
