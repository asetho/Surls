export const WEB_APP_MANIFEST_PATH = "/site.webmanifest";

const MANIFEST_BASE_URL = new URL("https://surls.invalid");
const ASCII_CONTROL = /[\u0000-\u001f\u007f]/;

export function safeManifestStartPath(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    ASCII_CONTROL.test(value)
  ) {
    return "/";
  }

  try {
    const url = new URL(value, MANIFEST_BASE_URL);
    return url.origin === MANIFEST_BASE_URL.origin && !url.search && !url.hash ? url.pathname : "/";
  } catch {
    return "/";
  }
}

export function manifestHrefForPath(pathname: string | null) {
  const startPath = safeManifestStartPath(pathname);
  return startPath === "/" ? WEB_APP_MANIFEST_PATH : `${WEB_APP_MANIFEST_PATH}?start=${encodeURIComponent(startPath)}`;
}
