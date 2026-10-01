import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { faviconsFromUpload } from "@/lib/favicons";

const routeMocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  publicWebrootResponse: vi.fn()
}));

vi.mock("@/lib/settings", () => ({
  getSettings: routeMocks.getSettings
}));

vi.mock("@/lib/webroot", () => ({
  publicWebrootResponse: routeMocks.publicWebrootResponse
}));

import { faviconRouteResponse } from "@/lib/favicon-routes";
import { GET as getWebManifest } from "@/app/site.webmanifest/route";

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const icoBytes = new Uint8Array([0, 0, 1, 0, 1, 0, 16, 16, 0, 0]);

function testFavicons() {
  const formData = new FormData();
  formData.set("faviconIco", new File([icoBytes], "favicon.ico", { type: "image/x-icon" }));
  formData.set("faviconSvg", new File(["<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"], "favicon.svg", { type: "image/svg+xml" }));
  formData.set("appleTouchIcon", new File([pngBytes], "apple-touch-icon.png", { type: "image/png" }));
  formData.set("icon192", new File([pngBytes], "icon-192.png", { type: "image/png" }));
  formData.set("icon512", new File([pngBytes], "icon-512.png", { type: "image/png" }));
  return faviconsFromUpload(formData);
}

describe("favicon routes", () => {
  beforeEach(() => {
    routeMocks.getSettings.mockReset();
    routeMocks.publicWebrootResponse.mockReset();
  });

  it("serves uploaded favicons before webroot fallback", async () => {
    routeMocks.getSettings.mockResolvedValue({
      favicons: await testFavicons(),
      siteName: "Surls"
    });

    const response = await faviconRouteResponse("faviconSvg");

    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(routeMocks.publicWebrootResponse).not.toHaveBeenCalled();
  });

  it("falls back to the public webroot when no uploaded favicon exists", async () => {
    const fallback = new Response("ico", { headers: { "Content-Type": "image/x-icon" } });
    routeMocks.getSettings.mockResolvedValue({ favicons: null, siteName: "Surls" });
    routeMocks.publicWebrootResponse.mockResolvedValue(fallback);

    await expect(faviconRouteResponse("faviconIco")).resolves.toBe(fallback);
    expect(routeMocks.publicWebrootResponse).toHaveBeenCalledWith(["favicon.ico"], {});
  });

  it("generates a manifest for uploaded favicon packages without a manifest file", async () => {
    const formData = new FormData();
    formData.set("faviconIco", new File([icoBytes], "favicon.ico", { type: "image/x-icon" }));
    formData.set("faviconSvg", new File(["<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"], "favicon.svg", { type: "image/svg+xml" }));
    formData.set("appleTouchIcon", new File([pngBytes], "apple-touch-icon.png", { type: "image/png" }));
    formData.set("icon192", new File([pngBytes], "icon-192.png", { type: "image/png" }));
    formData.set("icon512", new File([pngBytes], "icon-512.png", { type: "image/png" }));
    formData.set("manifestName", "asetho link");
    formData.set("manifestShortName", "ase.link");
    routeMocks.getSettings.mockResolvedValue({
      favicons: await faviconsFromUpload(formData),
      siteName: "Surls"
    });

    const response = await getWebManifest(new NextRequest("https://surls.example/site.webmanifest?start=%2Fadmin"));

    expect(response.headers.get("content-type")).toBe("application/manifest+json; charset=utf-8");
    await expect(response.json()).resolves.toMatchObject({
      name: "asetho link",
      short_name: "ase.link",
      start_url: "/admin",
      scope: "/"
    });

    const unsafeResponse = await getWebManifest(
      new NextRequest("https://surls.example/site.webmanifest?start=https%3A%2F%2Fother.example%2Fadmin")
    );
    await expect(unsafeResponse.json()).resolves.toMatchObject({ start_url: "/" });
  });

  it("uses the bundled Surls icon only after uploaded and mounted assets are absent", async () => {
    const bundled = new Response("surls svg");
    routeMocks.getSettings.mockResolvedValue({ favicons: null, siteName: "Surls" });
    routeMocks.publicWebrootResponse.mockResolvedValueOnce(null).mockResolvedValueOnce(bundled);

    await expect(faviconRouteResponse("faviconSvg", { method: "HEAD" })).resolves.toBe(bundled);
    expect(routeMocks.publicWebrootResponse).toHaveBeenNthCalledWith(1, ["favicon.svg"], { method: "HEAD" });
    expect(routeMocks.publicWebrootResponse).toHaveBeenNthCalledWith(2, ["surls-app-icon.svg"], {
      method: "HEAD", rootDir: expect.stringMatching(/public\/brand$/)
    });
  });

  it("does not replace a custom site's missing branding with the Surls icon", async () => {
    routeMocks.getSettings.mockResolvedValue({ favicons: null, siteName: "Private links" });
    routeMocks.publicWebrootResponse.mockResolvedValue(null);
    expect((await faviconRouteResponse("faviconSvg")).status).toBe(404);
    expect(routeMocks.publicWebrootResponse).toHaveBeenCalledTimes(1);
  });

  it("provides a default Surls manifest with a safe start path", async () => {
    routeMocks.getSettings.mockResolvedValue({ favicons: null, siteName: "Surls" });
    routeMocks.publicWebrootResponse.mockResolvedValue(null);
    const response = await getWebManifest(new NextRequest("https://surls.example/site.webmanifest?start=%2Fadmin"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ name: "Surls", start_url: "/admin", icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ] });
  });
});
