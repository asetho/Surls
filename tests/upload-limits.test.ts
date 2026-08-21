import { describe, expect, it } from "vitest";
import {
  effectiveUploadMaxBytes,
  siteUploadLimitFromFormData,
  uploadBytesToMegabytes,
  userUploadLimitFromFormData,
  userUploadLimitMode
} from "@/lib/upload-limits";

function limitForm(mode: string, megabytes = "25") {
  const formData = new FormData();
  formData.set("uploadLimitMode", mode);
  formData.set("uploadMaxMegabytes", megabytes);
  return formData;
}

describe("upload limit policies", () => {
  it("resolves custom, unlimited, and site-default user limits", () => {
    expect(effectiveUploadMaxBytes({ uploadMaxBytes: 10n * 1024n * 1024n }, 25 * 1024 * 1024)).toBe(10 * 1024 * 1024);
    expect(effectiveUploadMaxBytes({ uploadLimitUnlimited: true }, 25 * 1024 * 1024)).toBeNull();
    expect(effectiveUploadMaxBytes({}, 25 * 1024 * 1024)).toBe(25 * 1024 * 1024);
    expect(effectiveUploadMaxBytes({}, null)).toBeNull();
  });

  it("normalizes user form choices", () => {
    expect(userUploadLimitFromFormData(limitForm("default"))).toEqual({
      uploadLimitUnlimited: false,
      uploadMaxBytes: null
    });
    expect(userUploadLimitFromFormData(limitForm("custom", "50"))).toEqual({
      uploadLimitUnlimited: false,
      uploadMaxBytes: 50n * 1024n * 1024n
    });
    expect(userUploadLimitFromFormData(limitForm("unlimited"))).toEqual({
      uploadLimitUnlimited: true,
      uploadMaxBytes: null
    });
  });

  it("normalizes site choices and rejects unsafe values", () => {
    const limited = new FormData();
    limited.set("siteUploadLimitMode", "limited");
    limited.set("siteUploadMaxMegabytes", "100");
    expect(siteUploadLimitFromFormData(limited)).toBe(100 * 1024 * 1024);

    limited.set("siteUploadMaxMegabytes", "1025");
    expect(() => siteUploadLimitFromFormData(limited)).toThrow(/1 to 1024 MB/);

    const unlimited = new FormData();
    unlimited.set("siteUploadLimitMode", "unlimited");
    expect(siteUploadLimitFromFormData(unlimited)).toBeNull();
  });

  it("provides stable form display helpers", () => {
    expect(userUploadLimitMode({})).toBe("default");
    expect(userUploadLimitMode({ uploadMaxBytes: 10n })).toBe("custom");
    expect(userUploadLimitMode({ uploadLimitUnlimited: true, uploadMaxBytes: 10n })).toBe("unlimited");
    expect(uploadBytesToMegabytes(25n * 1024n * 1024n)).toBe(25);
  });
});
