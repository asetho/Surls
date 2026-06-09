import { describe, expect, it } from "vitest";
import {
  apiQrAssetPath,
  generateQrEps,
  normalizeQrErrorCorrectionLevel,
  normalizeQrFormat,
  normalizeQrSize,
  qrAssetPath
} from "@/lib/qr";

describe("QR helpers", () => {
  it("normalizes size, format, and error correction values", () => {
    expect(normalizeQrSize("150")).toBe(150);
    expect(normalizeQrSize("999")).toBe(300);
    expect(normalizeQrErrorCorrectionLevel("h")).toBe("H");
    expect(normalizeQrErrorCorrectionLevel("bad")).toBe("M");
    expect(normalizeQrFormat("svg")).toBe("svg");
    expect(normalizeQrFormat("pdf")).toBeNull();
  });

  it("builds direct and download vanity QR asset paths", () => {
    expect(qrAssetPath({ code: "surls", format: "png", size: 150, level: "Q" })).toBe(
      "/surls/qr/png?size=150&level=Q"
    );
    expect(qrAssetPath({ code: "team-tags", format: "eps", size: 500, level: "H", download: true })).toBe(
      "/team-tags/qr/eps?size=500&level=H&download=1"
    );
    expect(qrAssetPath({ code: "team tags", format: "svg", size: 300, level: "M" })).toBe(
      "/team%20tags/qr/svg?size=300&level=M"
    );
  });

  it("keeps legacy API QR asset paths available", () => {
    expect(apiQrAssetPath({ linkId: "link_1", format: "png", size: 150, level: "Q" })).toBe(
      "/api/links/link_1/qr/png?size=150&level=Q"
    );
    expect(apiQrAssetPath({ linkId: "link_1", format: "eps", size: 500, level: "H", download: true })).toBe(
      "/api/links/link_1/qr/eps?size=500&level=H&download=1"
    );
  });

  it("generates EPS QR output", () => {
    const eps = generateQrEps("https://example.com", 150, "M");
    expect(eps).toContain("%!PS-Adobe-3.0 EPSF-3.0");
    expect(eps).toContain("%%BoundingBox: 0 0 150 150");
    expect(eps).toContain("rectfill");
  });
});
