import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  appSetting: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn()
  }
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

describe("site upload limit settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves an explicit no-limit value instead of replacing it with the environment default", async () => {
    prisma.appSetting.findUnique.mockResolvedValue({ key: "uploadMaxBytes", value: null });
    prisma.appSetting.findMany.mockResolvedValue([{ key: "uploadMaxBytes", value: null }]);
    const { getSettings, getSiteUploadMaxBytes } = await import("@/lib/settings");

    await expect(getSiteUploadMaxBytes()).resolves.toBeNull();
    await expect(getSettings()).resolves.toMatchObject({ uploadMaxBytes: null });
  });

  it("falls back when a stored upload limit is malformed", async () => {
    prisma.appSetting.findUnique.mockResolvedValue({ key: "uploadMaxBytes", value: "large" });
    const { DEFAULT_SETTINGS, getSiteUploadMaxBytes } = await import("@/lib/settings");

    await expect(getSiteUploadMaxBytes()).resolves.toBe(DEFAULT_SETTINGS.uploadMaxBytes);
  });
});
