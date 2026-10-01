import path from "node:path";
import { buildGeneratedWebManifest, faviconResponse, type FaviconAssetKey, webManifestResponse } from "./favicons";
import { getSettings } from "./settings";
import { publicWebrootResponse } from "./webroot";

const FAVICON_WEBROOT_PATHS: Record<FaviconAssetKey, string[]> = {
  faviconIco: ["favicon.ico"],
  faviconSvg: ["favicon.svg"],
  appleTouchIcon: ["apple-touch-icon.png"],
  icon192: ["icon-192.png"],
  icon512: ["icon-512.png"]
};

const DEFAULT_FAVICON_FILES: Record<FaviconAssetKey, string> = {
  faviconIco: "favicon.ico",
  faviconSvg: "surls-app-icon.svg",
  appleTouchIcon: "surls-app-icon-180.png",
  icon192: "surls-app-icon-192.png",
  icon512: "surls-app-icon-512.png"
};

export async function faviconRouteResponse(key: FaviconAssetKey, options: { method?: string } = {}) {
  const settings = await getSettings();
  return (
    faviconResponse(settings.favicons, key, options) ??
    (await publicWebrootResponse(FAVICON_WEBROOT_PATHS[key], options)) ??
    (settings.siteName === "Surls" ? await publicWebrootResponse([DEFAULT_FAVICON_FILES[key]], {
      ...options,
      rootDir: path.join(process.cwd(), "public", "brand")
    }) : null) ??
    new Response(options.method?.toUpperCase() === "HEAD" ? null : "Not found", { status: 404 })
  );
}

export async function webManifestRouteResponse(options: { method?: string; startPath?: string } = {}) {
  const settings = await getSettings();
  const dashboardTheme = settings.dashboardTheme;
  const manifestOptions = {
    ...options,
    themeColors: dashboardTheme ? {
      backgroundColor: dashboardTheme.light.background,
      themeColor: dashboardTheme.light.accent
    } : undefined
  };
  return (
    webManifestResponse(settings.favicons, settings.siteName, manifestOptions) ??
    (await publicWebrootResponse(["site.webmanifest"], options.method ? { method: options.method } : {})) ??
    (settings.siteName === "Surls" ? new Response(options.method?.toUpperCase() === "HEAD" ? null :
      buildGeneratedWebManifest(settings.siteName, undefined, manifestOptions.themeColors, options.startPath), {
      headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=300" }
    }) : null) ??
    new Response(options.method?.toUpperCase() === "HEAD" ? null : "Not found", { status: 404 })
  );
}
