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
  siteManifest?: StoredFaviconAsset | null;
  updatedAt: string;
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
export const FAVICON_HTML_SNIPPET = [
  '<link rel="icon" href="/favicon.ico" sizes="any">',
  '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  '<link rel="manifest" href="/site.webmanifest">'
].join("\n");

const FAVICON_ASSET_BY_KEY = new Map(FAVICON_ASSETS.map((asset) => [asset.key, asset]));
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

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

export function normalizeFavicons(value: unknown): StoredFavicons | null {
  if (!isRecord(value) || !isRecord(value.assets)) return null;
  const storedAssets = value.assets;

  const assets = Object.fromEntries(
    REQUIRED_FAVICON_ASSETS.map((asset) => [asset.key, normalizeStoredFaviconAsset(storedAssets[asset.key])])
  ) as Partial<Record<FaviconAssetKey, StoredFaviconAsset | null>>;

  if (REQUIRED_FAVICON_ASSETS.some((asset) => !assets[asset.key])) return null;

  const siteManifest = normalizeStoredFaviconAsset(value.siteManifest);
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString();
  return {
    assets: assets as Record<FaviconAssetKey, StoredFaviconAsset>,
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

async function faviconAssetFromFile(value: FormDataEntryValue | null, spec: FaviconAssetSpec) {
  if (!isFileLike(value) || value.size === 0) {
    if (spec.required) throw new Error(`Upload ${spec.label}.`);
    return null;
  }
  const fileName = value.name.trim() || spec.url.slice(1);
  if (!fileNameHasExtension(fileName, spec.extension)) {
    throw new Error(`${spec.label} must use the ${spec.extension} extension.`);
  }
  if (value.type && !spec.mimeTypes.includes(value.type.toLowerCase())) {
    throw new Error(`${spec.label} must use one of these content types: ${spec.mimeTypes.join(", ")}.`);
  }
  if (value.size > spec.maxBytes) {
    throw new Error(`${spec.label} must be ${Math.ceil(spec.maxBytes / 1024)} KB or smaller.`);
  }

  const buffer = Buffer.from(await value.arrayBuffer());
  const bytes = new Uint8Array(buffer);
  if (spec.extension === ".png" && !hasPngSignature(bytes)) throw new Error(`${spec.label} must be a PNG image.`);
  if (spec.extension === ".ico" && !hasIcoSignature(bytes)) throw new Error(`${spec.label} must be an ICO file.`);
  if (spec.extension === ".svg") validateSvg(buffer.toString("utf8"));
  if (spec.extension === ".webmanifest") validateManifest(buffer.toString("utf8"));

  return {
    base64: buffer.toString("base64"),
    contentType: spec.contentType,
    fileName,
    size: value.size,
    updatedAt: new Date().toISOString()
  };
}

export async function faviconsFromUpload(formData: FormData): Promise<StoredFavicons> {
  const entries = await Promise.all(
    FAVICON_ASSETS.map(async (spec) => [spec.key, await faviconAssetFromFile(formData.get(spec.fieldName), spec)] as const)
  );
  const assets = Object.fromEntries(
    entries.filter((entry): entry is readonly [FaviconAssetKey, StoredFaviconAsset] => entry[0] !== "siteManifest")
  ) as Record<FaviconAssetKey, StoredFaviconAsset>;
  const siteManifest = entries.find((entry) => entry[0] === "siteManifest")?.[1] ?? null;

  return {
    assets,
    siteManifest,
    updatedAt: new Date().toISOString()
  };
}

export function buildGeneratedWebManifest(siteName: string) {
  const name = siteName.trim() || "Surls";
  return JSON.stringify(
    {
      name,
      short_name: name,
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
      ],
      start_url: "/",
      display: "standalone",
      background_color: "#1f6a5d",
      theme_color: "#1f6a5d"
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
  options: { method?: string } = {}
) {
  if (!favicons) return null;
  const manifest = favicons.siteManifest
    ? Buffer.from(favicons.siteManifest.base64, "base64").toString("utf8")
    : buildGeneratedWebManifest(siteName);
  const body = options.method?.toUpperCase() === "HEAD" ? null : manifest;

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Length": String(Buffer.byteLength(manifest)),
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Last-Modified": new Date(favicons.siteManifest?.updatedAt ?? favicons.updatedAt).toUTCString(),
      "X-Content-Type-Options": "nosniff"
    }
  });
}
