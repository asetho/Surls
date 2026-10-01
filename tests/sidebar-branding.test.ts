import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { DEFAULT_SIDEBAR_BRANDING, normalizeSidebarBranding, SIDEBAR_LOGO_MAX_BYTES } from "@/lib/sidebar-branding";
import { sidebarBrandingFromJson, sidebarLogoImage } from "@/lib/sidebar-branding-server";

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#0488a5"/></svg>';
const encode = (value: string) => Buffer.from(value).toString("base64");

describe("sidebar branding", () => {
  it("keeps older settings on default branding and bounds image sizes", () => {
    expect(normalizeSidebarBranding(undefined)).toEqual(DEFAULT_SIDEBAR_BRANDING);
    expect(normalizeSidebarBranding({ logo: "placeholder", logoHeight: 200 }).logoHeight).toBe(64);
    expect(normalizeSidebarBranding({ logo: "placeholder", logoHeight: 2 }).logoHeight).toBe(20);
    expect(normalizeSidebarBranding({ lightImage: "https://example.com/tracker.svg" }).lightImage).toBe("");
  });
  it("accepts uploaded SVG and base64, preserving proportions in safe PNG output", async () => {
    const upload = await sidebarLogoImage(new File([svg], "logo.svg", { type: "image/svg+xml" }));
    const pasted = await sidebarLogoImage(`data:image/svg+xml;base64,${encode(svg)}`);
    expect(upload).toBe(pasted);
    const metadata = await sharp(Buffer.from(upload.split(",")[1], "base64")).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(40);
    expect(metadata.height).toBe(20);
  });
  it.each([
    '<svg><script>alert(1)</script></svg>',
    '<svg><image href="file:///etc/passwd"/></svg>',
    '<!DOCTYPE svg><svg/>',
    '<svg onload="alert(1)"/>',
    '<svg><style>@import "https://example.com/a.css";</style></svg>'
  ])("rejects active or externally linked SVG: %s", async (value) => {
    await expect(sidebarLogoImage(encode(value))).rejects.toThrow();
  });
  it("rejects invalid, empty, and oversized input", async () => {
    for (const input of ["", "https://example.com/logo.png", encode("not an image")]) {
      await expect(sidebarLogoImage(input)).rejects.toThrow();
    }
    await expect(sidebarLogoImage(new File([new Uint8Array(SIDEBAR_LOGO_MAX_BYTES + 1)], "big.png"))).rejects.toThrow("512 KB");
  });
  it("round trips custom branding and rejects invisible saved branding", async () => {
    const custom = { ...DEFAULT_SIDEBAR_BRANDING, logo: "custom", text: " Team links ", logoHeight: 44, darkImage: encode(svg) };
    const stored = await sidebarBrandingFromJson(JSON.stringify(custom));
    expect(stored.text).toBe("Team links");
    expect(stored.logoHeight).toBe(44);
    expect(await sidebarBrandingFromJson(JSON.stringify(stored))).toEqual(stored);
    for (const logo of ["custom", "none"]) {
      await expect(sidebarBrandingFromJson(JSON.stringify({ ...DEFAULT_SIDEBAR_BRANDING, logo }))).rejects.toThrow();
    }
  });
});
