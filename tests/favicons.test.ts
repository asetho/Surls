import { describe, expect, it } from "vitest";
import {
  buildGeneratedWebManifest,
  faviconResponse,
  faviconsFromUpload,
  webManifestResponse
} from "@/lib/favicons";

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const icoBytes = new Uint8Array([0, 0, 1, 0, 1, 0, 16, 16, 0, 0]);

function faviconForm(overrides: Partial<Record<string, File>> = {}) {
  const formData = new FormData();
  formData.set("faviconIco", new File([icoBytes], "favicon.ico", { type: "image/x-icon" }));
  formData.set("faviconSvg", new File(["<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1 1\"></svg>"], "favicon.svg", { type: "image/svg+xml" }));
  formData.set("appleTouchIcon", new File([pngBytes], "apple-touch-icon.png", { type: "image/png" }));
  formData.set("icon192", new File([pngBytes], "icon-192.png", { type: "image/png" }));
  formData.set("icon512", new File([pngBytes], "icon-512.png", { type: "image/png" }));
  for (const [key, value] of Object.entries(overrides)) {
    if (value) formData.set(key, value);
  }
  return formData;
}

describe("favicon uploads", () => {
  it("stores a complete favicon package", async () => {
    const favicons = await faviconsFromUpload(faviconForm());

    expect(favicons.assets.faviconIco).toMatchObject({
      contentType: "image/x-icon",
      fileName: "favicon.ico"
    });
    expect(favicons.assets.faviconSvg.contentType).toContain("image/svg+xml");
    expect(favicons.assets.icon192.contentType).toBe("image/png");
    expect(favicons.siteManifest).toBeNull();
  });

  it("stores an optional manifest when provided", async () => {
    const manifest = new File([JSON.stringify({ name: "Surls" })], "site.webmanifest", {
      type: "application/manifest+json"
    });

    const favicons = await faviconsFromUpload(faviconForm({ siteManifest: manifest }));

    expect(favicons.siteManifest).toMatchObject({
      contentType: "application/manifest+json; charset=utf-8",
      fileName: "site.webmanifest"
    });
  });

  it("rejects unsafe SVG and invalid manifests", async () => {
    await expect(
      faviconsFromUpload(
        faviconForm({
          faviconSvg: new File(["<svg onload=\"alert(1)\"></svg>"], "favicon.svg", { type: "image/svg+xml" })
        })
      )
    ).rejects.toThrow(/event handlers/i);

    await expect(
      faviconsFromUpload(
        faviconForm({
          siteManifest: new File(["not json"], "site.webmanifest", { type: "application/manifest+json" })
        })
      )
    ).rejects.toThrow(/valid JSON/i);
  });
});

describe("favicon responses", () => {
  it("serves uploaded favicon assets", async () => {
    const favicons = await faviconsFromUpload(faviconForm());
    const response = faviconResponse(favicons, "faviconIco");

    expect(response?.headers.get("content-type")).toBe("image/x-icon");
    expect(response?.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response?.headers.get("content-length")).toBe(String(icoBytes.byteLength));
    expect(new Uint8Array(await response!.arrayBuffer())).toEqual(icoBytes);
  });

  it("generates a web manifest when none was uploaded", async () => {
    const favicons = await faviconsFromUpload(faviconForm());
    const response = webManifestResponse(favicons, "Asetho Surls");

    expect(response?.headers.get("content-type")).toBe("application/manifest+json; charset=utf-8");
    await expect(response?.json()).resolves.toMatchObject({
      name: "Asetho Surls",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
      ]
    });
  });

  it("returns no body for HEAD requests", async () => {
    const favicons = await faviconsFromUpload(faviconForm());
    const response = faviconResponse(favicons, "icon512", { method: "HEAD" });

    await expect(response?.text()).resolves.toBe("");
  });

  it("keeps generated manifests parseable", () => {
    expect(JSON.parse(buildGeneratedWebManifest("Surls"))).toMatchObject({
      short_name: "Surls",
      start_url: "/"
    });
  });
});
