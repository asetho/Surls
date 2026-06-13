import { faviconResponse, type FaviconAssetKey, webManifestResponse } from "./favicons";
import { getSettings } from "./settings";
import { publicWebrootResponse } from "./webroot";

const FAVICON_WEBROOT_PATHS: Record<FaviconAssetKey, string[]> = {
  faviconIco: ["favicon.ico"],
  faviconSvg: ["favicon.svg"],
  appleTouchIcon: ["apple-touch-icon.png"],
  icon192: ["icon-192.png"],
  icon512: ["icon-512.png"]
};

export async function faviconRouteResponse(key: FaviconAssetKey, options: { method?: string } = {}) {
  const settings = await getSettings();
  return (
    faviconResponse(settings.favicons, key, options) ??
    (await publicWebrootResponse(FAVICON_WEBROOT_PATHS[key], options)) ??
    new Response(options.method?.toUpperCase() === "HEAD" ? null : "Not found", { status: 404 })
  );
}

export async function webManifestRouteResponse(options: { method?: string } = {}) {
  const settings = await getSettings();
  return (
    webManifestResponse(settings.favicons, settings.siteName, options) ??
    (await publicWebrootResponse(["site.webmanifest"], options)) ??
    new Response(options.method?.toUpperCase() === "HEAD" ? null : "Not found", { status: 404 })
  );
}
