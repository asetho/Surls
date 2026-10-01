import sharp from "sharp";
import { validateSvgImage } from "./favicons";
import { normalizeSidebarBranding, SIDEBAR_LOGO_MAX_BYTES, SIDEBAR_LOGO_MAX_ENCODED_LENGTH } from "./sidebar-branding";

// Decode and re-encode uploads before they can be previewed or stored as image URLs.
export async function sidebarLogoImage(value: string | File): Promise<string> {
  let buffer: Buffer;
  if (typeof value === "string") {
    if (value.length > SIDEBAR_LOGO_MAX_ENCODED_LENGTH) throw new Error("Logo must be 512 KB or smaller.");
    const encoded = value.trim().replace(/^data:image\/(?:png|jpeg|webp|svg\+xml);base64,/i, "").replace(/\s/g, "");
    if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 === 1) {
      throw new Error("Paste a base64 image or an image data URL.");
    }
    buffer = Buffer.from(encoded, "base64");
  } else {
    if (value.size > SIDEBAR_LOGO_MAX_BYTES) throw new Error("Logo must be 512 KB or smaller.");
    buffer = Buffer.from(await value.arrayBuffer());
  }
  if (!buffer.length || buffer.length > SIDEBAR_LOGO_MAX_BYTES) throw new Error("Logo must be 512 KB or smaller.");
  const raster = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
    (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP");
  if (!raster) {
    const text = buffer.toString("utf8");
    validateSvgImage(text, "Logo");
    // Standalone logo vectors cannot load styles, fonts, or nested image documents.
    if (/@import|<image\b|<feImage\b|\\|&#/i.test(text)) throw new Error("Use a standalone SVG without embedded images or external styles.");
  }
  try {
    const image = sharp(buffer, { limitInputPixels: 16_000_000 });
    const metadata = await image.metadata();
    if (!["svg", "png", "jpeg", "webp"].includes(metadata.format ?? "")) throw new Error("Unsupported format");
    if ((metadata.width ?? 0) > 4000 || (metadata.height ?? 0) > 4000) throw new Error("Image dimensions too large");
    const output = await image.rotate().resize({ width: 640, height: 256, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    if (output.length > SIDEBAR_LOGO_MAX_BYTES) throw new Error("Image too large");
    return `data:image/png;base64,${output.toString("base64")}`;
  } catch {
    throw new Error("Choose a valid SVG, PNG, JPEG, or WebP logo up to 4000 × 4000 pixels.");
  }
}

export async function sidebarBrandingFromJson(value: string) {
  if (value.length > SIDEBAR_LOGO_MAX_ENCODED_LENGTH * 2 + 1024) throw new Error("Branding images are too large.");
  let input: Record<string, unknown>;
  try { input = JSON.parse(value); } catch { throw new Error("Invalid sidebar branding."); }
  if (!input || typeof input !== "object" || Array.isArray(input) ||
    !["placeholder", "custom", "none"].includes(String(input.logo)) ||
    typeof input.text !== "string" || input.text.trim().length > 60 ||
    typeof input.lightImage !== "string" || typeof input.darkImage !== "string") {
    throw new Error("Check the sidebar logo and text (60 characters maximum).");
  }
  const branding = normalizeSidebarBranding(input);
  branding.lightImage = input.lightImage ? await sidebarLogoImage(input.lightImage) : "";
  branding.darkImage = input.darkImage ? await sidebarLogoImage(input.darkImage) : "";
  if (branding.logo === "custom" && !branding.lightImage && !branding.darkImage) throw new Error("Add a custom logo before saving.");
  if (branding.logo === "none" && !branding.text) throw new Error("Enter sidebar text or choose a logo.");
  return branding;
}
