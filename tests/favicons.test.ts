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
    expect(favicons.manifestName).toBe("Surls");
    expect(favicons.manifestShortName).toBe("Surls");
    expect(favicons.assets.faviconSvg.contentType).toContain("image/svg+xml");
    expect(favicons.assets.icon192.contentType).toBe("image/png");
    expect(favicons.siteManifest).toBeNull();
  });

  it("stores generated manifest names from the upload form", async () => {
    const formData = faviconForm();
    formData.set("manifestName", "asetho link");
    formData.set("manifestShortName", "ase.link");

    const favicons = await faviconsFromUpload(formData, { siteName: "Fallback" });

    expect(favicons.manifestName).toBe("asetho link");
    expect(favicons.manifestShortName).toBe("ase.link");
  });

  it("preserves existing manifest names when an icon package is reuploaded", async () => {
    const favicons = await faviconsFromUpload(faviconForm(), {
      manifestName: "asetho link",
      manifestShortName: "ase.link",
      siteName: "Fallback"
    });

    expect(favicons.manifestName).toBe("asetho link");
    expect(favicons.manifestShortName).toBe("ase.link");
  });

  it("replaces only selected favicon files when existing favicons are saved", async () => {
    const existingFavicons = await faviconsFromUpload(faviconForm(), {
      manifestName: "asetho link",
      manifestShortName: "ase.link"
    });
    const updatedSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 2 2\"></svg>";
    const formData = new FormData();
    formData.set("faviconSvg", new File([updatedSvg], "favicon.svg", { type: "image/svg+xml" }));

    const favicons = await faviconsFromUpload(formData, { existingFavicons, siteName: "Fallback" });

    expect(favicons.assets.faviconSvg.base64).toBe(Buffer.from(updatedSvg).toString("base64"));
    expect(favicons.assets.faviconIco).toBe(existingFavicons.assets.faviconIco);
    expect(favicons.assets.appleTouchIcon).toBe(existingFavicons.assets.appleTouchIcon);
    expect(favicons.manifestName).toBe("asetho link");
    expect(favicons.manifestShortName).toBe("ase.link");
  });

  it("requires missing required files during first favicon setup", async () => {
    const formData = new FormData();
    formData.set("faviconSvg", new File(["<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"], "favicon.svg", { type: "image/svg+xml" }));

    await expect(faviconsFromUpload(formData)).rejects.toThrow(/ICO favicon/i);
  });

  it("rejects empty favicon uploads", async () => {
    await expect(faviconsFromUpload(new FormData())).rejects.toThrow(/at least one favicon file/i);
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

  it("accepts valid web manifests reported as generic uploads", async () => {
    const manifest = new File([JSON.stringify({ name: "Surls" })], "site.webmanifest", {
      type: "application/octet-stream"
    });

    const favicons = await faviconsFromUpload(faviconForm({ siteManifest: manifest }));

    expect(favicons.siteManifest).toMatchObject({
      contentType: "application/manifest+json; charset=utf-8",
      fileName: "site.webmanifest"
    });
  });

  it("rejects web manifests with non-json content types", async () => {
    await expect(
      faviconsFromUpload(
        faviconForm({
          siteManifest: new File([JSON.stringify({ name: "Surls" })], "site.webmanifest", { type: "text/html" })
        })
      )
    ).rejects.toThrow(/content types/i);
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

  it("rejects embedded SVG content and external references", async () => {
    await expect(
      faviconsFromUpload(faviconForm({
        faviconSvg: new File(["<svg><foreignObject><iframe src='https://example.test'></iframe></foreignObject></svg>"], "favicon.svg", { type: "image/svg+xml" })
      }))
    ).rejects.toThrow(/active content/i);

    await expect(
      faviconsFromUpload(faviconForm({
        faviconSvg: new File(["<svg><image href='https://example.test/icon.png'/></svg>"], "favicon.svg", { type: "image/svg+xml" })
      }))
    ).rejects.toThrow(/external content/i);
  });

  it("rejects oversized assets before decoding their contents", async () => {
    const oversized = new File([new Uint8Array(128 * 1024 + 1)], "favicon.svg", { type: "image/svg+xml" });
    await expect(faviconsFromUpload(faviconForm({ faviconSvg: oversized }))).rejects.toThrow(/128 KB or smaller/i);
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

  it("sandboxes SVG favicon responses", async () => {
    const favicons = await faviconsFromUpload(faviconForm());
    const response = faviconResponse(favicons, "faviconSvg");

    expect(response?.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response?.headers.get("content-security-policy")).toContain("sandbox");
  });

  it("generates a web manifest when none was uploaded", async () => {
    const formData = faviconForm();
    formData.set("manifestName", "asetho link");
    formData.set("manifestShortName", "ase.link");
    const favicons = await faviconsFromUpload(formData);
    const response = webManifestResponse(favicons, "Asetho Surls");

    expect(response?.headers.get("content-type")).toBe("application/manifest+json; charset=utf-8");
    await expect(response?.json()).resolves.toMatchObject({
      background_color: "#1f6a5d",
      name: "asetho link",
      short_name: "ase.link",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
      ],
      theme_color: "#1f6a5d"
    });
  });

  it("returns no body for HEAD requests", async () => {
    const favicons = await faviconsFromUpload(faviconForm());
    const response = faviconResponse(favicons, "icon512", { method: "HEAD" });

    await expect(response?.text()).resolves.toBe("");
  });

  it("keeps generated manifests parseable", () => {
    expect(
      JSON.parse(
        buildGeneratedWebManifest(
          "Surls",
          { name: "asetho link", shortName: "ase.link" },
          { backgroundColor: "#e9f2f6", themeColor: "#087e8b" },
          "/admin"
        )
      )
    ).toMatchObject({
      background_color: "#e9f2f6",
      name: "asetho link",
      short_name: "ase.link",
      start_url: "/admin",
      scope: "/",
      theme_color: "#087e8b"
    });
  });
});
