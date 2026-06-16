export const FAVICON_MANIFEST_PATH = "/site.webmanifest";

export type FaviconAssetKey = "faviconIco" | "faviconSvg" | "appleTouchIcon" | "icon192" | "icon512";
export type FaviconPackageKey = FaviconAssetKey | "siteManifest";

export type StoredFaviconAsset = {
  base64: string;
  contentType: string;
  fileName: string;
  size: number;
  updatedAt: string;
};

export type StoredFavicons = {
  assets: Record<FaviconAssetKey, StoredFaviconAsset>;
  manifestName?: string;
  manifestShortName?: string;
  siteManifest?: StoredFaviconAsset | null;
  updatedAt: string;
};

export type FaviconManifestNames = {
  name: string;
  shortName: string;
};

export type FaviconManifestThemeColors = {
  backgroundColor?: string;
  themeColor?: string;
};

type FaviconAssetSpec = {
  accept: string;
  contentType: string;
  extension: string;
  fieldName: FaviconPackageKey;
  key: FaviconPackageKey;
  label: string;
  maxBytes: number;
  mimeTypes: string[];
  required: boolean;
  url: string;
};

export const FAVICON_ASSETS = [
  {
    accept: ".ico,image/x-icon,image/vnd.microsoft.icon",
    contentType: "image/x-icon",
    extension: ".ico",
    fieldName: "faviconIco",
    key: "faviconIco",
    label: "ICO favicon",
    maxBytes: 512 * 1024,
    mimeTypes: ["image/x-icon", "image/vnd.microsoft.icon", "image/ico"],
    required: true,
    url: "/favicon.ico"
  },
  {
    accept: ".svg,image/svg+xml",
    contentType: "image/svg+xml; charset=utf-8",
    extension: ".svg",
    fieldName: "faviconSvg",
    key: "faviconSvg",
    label: "SVG favicon",
    maxBytes: 128 * 1024,
    mimeTypes: ["image/svg+xml"],
    required: true,
    url: "/favicon.svg"
  },
  {
    accept: ".png,image/png",
    contentType: "image/png",
    extension: ".png",
    fieldName: "appleTouchIcon",
    key: "appleTouchIcon",
    label: "Apple touch icon",
    maxBytes: 1024 * 1024,
    mimeTypes: ["image/png"],
    required: true,
    url: "/apple-touch-icon.png"
  },
  {
    accept: ".png,image/png",
    contentType: "image/png",
    extension: ".png",
    fieldName: "icon192",
    key: "icon192",
    label: "192px app icon",
    maxBytes: 1024 * 1024,
    mimeTypes: ["image/png"],
    required: true,
    url: "/icon-192.png"
  },
  {
    accept: ".png,image/png",
    contentType: "image/png",
    extension: ".png",
    fieldName: "icon512",
    key: "icon512",
    label: "512px app icon",
    maxBytes: 1024 * 1024,
    mimeTypes: ["image/png"],
    required: true,
    url: "/icon-512.png"
  },
  {
    accept: ".webmanifest,application/manifest+json,application/json",
    contentType: "application/manifest+json; charset=utf-8",
    extension: ".webmanifest",
    fieldName: "siteManifest",
    key: "siteManifest",
    label: "Web app manifest",
    maxBytes: 64 * 1024,
    mimeTypes: ["application/manifest+json", "application/json"],
    required: false,
    url: FAVICON_MANIFEST_PATH
  }
] as const satisfies readonly FaviconAssetSpec[];

export const REQUIRED_FAVICON_ASSETS = FAVICON_ASSETS.filter((asset) => asset.required);
export const FAVICON_UPLOAD_ASSETS = FAVICON_ASSETS.filter((asset) => asset.key !== "siteManifest");
export const FAVICON_HTML_SNIPPET = [
  '<link rel="icon" href="/favicon.ico" sizes="any">',
  '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  '<link rel="manifest" href="/site.webmanifest">'
].join("\n");

const FAVICON_ASSET_BY_KEY = new Map(FAVICON_ASSETS.map((asset) => [asset.key, asset]));
const FAVICON_MANIFEST_NAME_MAX_LENGTH = 64;
const FAVICON_MANIFEST_SHORT_NAME_MAX_LENGTH = 24;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const GENERIC_JSON_UPLOAD_MIME_TYPES = new Set(["application/octet-stream", "binary/octet-stream", "text/plain"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeStoredFaviconAsset(value: unknown): StoredFaviconAsset | null {
  if (!isRecord(value)) return null;
  const base64 = typeof value.base64 === "string" ? value.base64 : "";
  const contentType = typeof value.contentType === "string" ? value.contentType : "";
  const fileName = typeof value.fileName === "string" ? value.fileName : "";
  const size = typeof value.size === "number" && Number.isFinite(value.size) ? value.size : 0;
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : "";
  if (!base64 || !contentType || !fileName || size <= 0 || !updatedAt) return null;
  return { base64, contentType, fileName, size, updatedAt };
}

function plainTextSetting(value: unknown) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim() : "";
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength).trimEnd() : value;
}

export function normalizeFaviconManifestName(value: unknown, fallback: unknown = "Surls") {
  const fallbackName = truncateText(plainTextSetting(fallback) || "Surls", FAVICON_MANIFEST_NAME_MAX_LENGTH);
  return truncateText(plainTextSetting(value) || fallbackName, FAVICON_MANIFEST_NAME_MAX_LENGTH);
}

export function normalizeFaviconManifestShortName(value: unknown, fallbackName: unknown) {
  const fallback = truncateText(plainTextSetting(fallbackName) || "Surls", FAVICON_MANIFEST_SHORT_NAME_MAX_LENGTH);
  return truncateText(plainTextSetting(value) || fallback, FAVICON_MANIFEST_SHORT_NAME_MAX_LENGTH);
}

export function faviconManifestNamesFromFormData(
  formData: FormData,
  fallbackName: string,
  fallbackShortName?: string
): FaviconManifestNames {
  const name = normalizeFaviconManifestName(formData.get("manifestName"), fallbackName);
  return {
    name,
    shortName: normalizeFaviconManifestShortName(formData.get("manifestShortName"), fallbackShortName ?? name)
  };
}

export function getFaviconManifestNames(favicons: StoredFavicons | null, siteName: string): FaviconManifestNames {
  const name = normalizeFaviconManifestName(favicons?.manifestName, siteName);
  return {
    name,
    shortName: normalizeFaviconManifestShortName(favicons?.manifestShortName, name)
  };
}

export function faviconsWithManifestNames(favicons: StoredFavicons, formData: FormData, fallbackName: string): StoredFavicons {
  const currentNames = getFaviconManifestNames(favicons, fallbackName);
  const names = faviconManifestNamesFromFormData(formData, currentNames.name, currentNames.shortName);
  return {
    ...favicons,
    manifestName: names.name,
    manifestShortName: names.shortName,
    siteManifest: null,
    updatedAt: new Date().toISOString()
  };
}

export function normalizeFavicons(value: unknown): StoredFavicons | null {
  if (!isRecord(value) || !isRecord(value.assets)) return null;
  const storedAssets = value.assets;

  const assets = Object.fromEntries(
    REQUIRED_FAVICON_ASSETS.map((asset) => [asset.key, normalizeStoredFaviconAsset(storedAssets[asset.key])])
  ) as Partial<Record<FaviconAssetKey, StoredFaviconAsset | null>>;

  if (REQUIRED_FAVICON_ASSETS.some((asset) => !assets[asset.key])) return null;

  const siteManifest = normalizeStoredFaviconAsset(value.siteManifest);
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString();
  const manifestName = plainTextSetting(value.manifestName);
  const manifestShortName = plainTextSetting(value.manifestShortName);
  return {
    assets: assets as Record<FaviconAssetKey, StoredFaviconAsset>,
    manifestName: manifestName || undefined,
    manifestShortName: manifestShortName || undefined,
    siteManifest,
    updatedAt
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

function fileNameHasExtension(fileName: string, extension: string) {
  return fileName.trim().toLowerCase().endsWith(extension);
}

function reportedMimeType(value: File) {
  return value.type.split(";")[0]?.trim().toLowerCase() ?? "";
}

function acceptsMimeType(type: string, spec: FaviconAssetSpec) {
  if (!type || spec.mimeTypes.includes(type)) return true;
  return spec.extension === ".webmanifest" && GENERIC_JSON_UPLOAD_MIME_TYPES.has(type);
}

function acceptsReportedMimeType(value: File, spec: FaviconAssetSpec) {
  return acceptsMimeType(reportedMimeType(value), spec);
}

function hasPngSignature(bytes: Uint8Array) {
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

function hasIcoSignature(bytes: Uint8Array) {
  return bytes.length >= 6 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0 && (bytes[4] !== 0 || bytes[5] !== 0);
}

function validateSvg(svg: string) {
  const trimmed = svg.trim();
  if (!/<svg(?:\s|>)/i.test(trimmed)) throw new Error("SVG favicon must contain an <svg> root element.");
  if (/<script(?:\s|>)/i.test(trimmed)) throw new Error("SVG favicon cannot contain scripts.");
  if (/\son[a-z]+\s*=/i.test(trimmed)) throw new Error("SVG favicon cannot contain inline event handlers.");
  if (/javascript:/i.test(trimmed)) throw new Error("SVG favicon cannot contain javascript: URLs.");
}

function validateManifest(manifest: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(manifest);
  } catch {
    throw new Error("site.webmanifest must contain valid JSON.");
  }
  if (!isRecord(parsed)) throw new Error("site.webmanifest must contain a JSON object.");
}

function faviconAssetFromBuffer(fileName: string, reportedType: string, buffer: Buffer, spec: FaviconAssetSpec, options: { skipReportedMimeType?: boolean } = {}) {
  if (!fileNameHasExtension(fileName, spec.extension)) {
    throw new Error(`${spec.label} must use the ${spec.extension} extension.`);
  }
  if (!options.skipReportedMimeType && !acceptsMimeType(reportedType, spec)) {
    throw new Error(`${spec.label} must use one of these content types: ${spec.mimeTypes.join(", ")}.`);
  }
  if (buffer.byteLength > spec.maxBytes) {
    throw new Error(`${spec.label} must be ${Math.ceil(spec.maxBytes / 1024)} KB or smaller.`);
  }

  const bytes = new Uint8Array(buffer);
  if (spec.extension === ".png" && !hasPngSignature(bytes)) throw new Error(`${spec.label} must be a PNG image.`);
  if (spec.extension === ".ico" && !hasIcoSignature(bytes)) throw new Error(`${spec.label} must be an ICO file.`);
  if (spec.extension === ".svg") validateSvg(buffer.toString("utf8"));
  if (spec.extension === ".webmanifest") validateManifest(buffer.toString("utf8"));

  return {
    base64: buffer.toString("base64"),
    contentType: spec.contentType,
    fileName,
    size: buffer.byteLength,
    updatedAt: new Date().toISOString()
  };
}

async function faviconAssetFromFile(value: FormDataEntryValue | null, spec: FaviconAssetSpec) {
  if (!isFileLike(value) || value.size === 0) return null;
  const fileName = value.name.trim() || spec.url.slice(1);
  if (!acceptsReportedMimeType(value, spec)) {
    throw new Error(`${spec.label} must use one of these content types: ${spec.mimeTypes.join(", ")}.`);
  }
  const buffer = Buffer.from(await value.arrayBuffer());
  return faviconAssetFromBuffer(fileName, reportedMimeType(value), buffer, spec);
}

export async function faviconsFromUpload(
  formData: FormData,
  options: { existingFavicons?: StoredFavicons | null; manifestName?: string; manifestShortName?: string; siteName?: string } = {}
): Promise<StoredFavicons> {
  const hasUploads = FAVICON_ASSETS.some((asset) => {
    const value = formData.get(asset.fieldName);
    return isFileLike(value) && value.size > 0;
  });
  if (!hasUploads) {
    throw new Error("Choose at least one favicon file to upload.");
  }

  const entries = await Promise.all(
    FAVICON_ASSETS.map(async (spec) => [spec.key, await faviconAssetFromFile(formData.get(spec.fieldName), spec)] as const)
  );
  const assets = Object.fromEntries(
    REQUIRED_FAVICON_ASSETS.map((spec) => {
      const uploaded = entries.find((entry) => entry[0] === spec.key)?.[1];
      const existing = options.existingFavicons?.assets[spec.key];
      if (!uploaded && !existing) throw new Error(`Upload ${spec.label}.`);
      return [spec.key, uploaded ?? existing] as const;
    })
  ) as Record<FaviconAssetKey, StoredFaviconAsset>;
  const uploadedSiteManifest = entries.find((entry) => entry[0] === "siteManifest")?.[1] ?? null;
  const siteManifest = uploadedSiteManifest ?? options.existingFavicons?.siteManifest ?? null;
  const names = faviconManifestNamesFromFormData(
    formData,
    options.manifestName ?? options.existingFavicons?.manifestName ?? options.siteName ?? "Surls",
    options.manifestShortName ?? options.existingFavicons?.manifestShortName
  );

  return {
    assets,
    manifestName: names.name,
    manifestShortName: names.shortName,
    siteManifest,
    updatedAt: new Date().toISOString()
  };
}

export function buildGeneratedWebManifest(
  siteName: string,
  names?: Partial<FaviconManifestNames>,
  colors: FaviconManifestThemeColors = {}
) {
  const name = normalizeFaviconManifestName(names?.name, siteName);
  const shortName = normalizeFaviconManifestShortName(names?.shortName, name);
  return JSON.stringify(
    {
      name,
      short_name: shortName,
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
      ],
      start_url: "/",
      display: "standalone",
      background_color: colors.backgroundColor ?? "#1f6a5d",
      theme_color: colors.themeColor ?? "#1f6a5d"
    },
    null,
    2
  );
}

export function faviconResponse(
  favicons: StoredFavicons | null,
  key: FaviconAssetKey,
  options: { method?: string } = {}
) {
  const spec = FAVICON_ASSET_BY_KEY.get(key);
  const asset = favicons?.assets[key];
  if (!spec || !asset) return null;

  const body = options.method?.toUpperCase() === "HEAD" ? null : Buffer.from(asset.base64, "base64");
  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Length": String(asset.size),
      "Content-Type": asset.contentType,
      "Last-Modified": new Date(asset.updatedAt).toUTCString(),
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export function webManifestResponse(
  favicons: StoredFavicons | null,
  siteName: string,
  options: { method?: string; themeColors?: FaviconManifestThemeColors } = {}
) {
  if (!favicons) return null;
  const manifest = buildGeneratedWebManifest(siteName, getFaviconManifestNames(favicons, siteName), options.themeColors);
  const body = options.method?.toUpperCase() === "HEAD" ? null : manifest;

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Length": String(Buffer.byteLength(manifest)),
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Last-Modified": new Date(favicons.updatedAt).toUTCString(),
      "X-Content-Type-Options": "nosniff"
    }
  });
}
