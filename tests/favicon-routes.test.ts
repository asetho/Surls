import { beforeEach, describe, expect, it, vi } from "vitest";
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

import { faviconRouteResponse, webManifestRouteResponse } from "@/lib/favicon-routes";

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
    routeMocks.getSettings.mockResolvedValue({
      favicons: await testFavicons(),
      siteName: "Surls"
    });

    const response = await webManifestRouteResponse();

    expect(response.headers.get("content-type")).toBe("application/manifest+json; charset=utf-8");
    await expect(response.json()).resolves.toMatchObject({ name: "Surls" });
  });
});
