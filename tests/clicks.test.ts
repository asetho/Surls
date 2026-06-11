import { beforeEach, describe, expect, it, vi } from "vitest";

const clickEvent = vi.hoisted(() => ({
  updateMany: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { clickEvent }
}));

import {
  DEFAULT_RECENT_CLICK_PAGE_SIZE,
  MAX_RECENT_CLICK_PAGE_SIZE,
  RAW_IP_RETENTION_DAYS,
  normalizeRecentClickPage,
  normalizeRecentClickPageSize,
  purgeExpiredRawIpAddresses,
  rawIpRetentionCutoff
} from "@/lib/clicks";

beforeEach(() => {
  clickEvent.updateMany.mockReset();
});

describe("click pagination helpers", () => {
  it("defaults invalid page and page size values", () => {
    expect(normalizeRecentClickPage("nope")).toBe(1);
    expect(normalizeRecentClickPageSize("nope")).toBe(DEFAULT_RECENT_CLICK_PAGE_SIZE);
  });

  it("accepts arbitrary positive page sizes and caps huge values", () => {
    expect(normalizeRecentClickPageSize("30")).toBe(30);
    expect(normalizeRecentClickPageSize("50")).toBe(50);
    expect(normalizeRecentClickPageSize(String(MAX_RECENT_CLICK_PAGE_SIZE + 1))).toBe(MAX_RECENT_CLICK_PAGE_SIZE);
  });

  it("uses a 30 day raw IP retention cutoff", () => {
    expect(RAW_IP_RETENTION_DAYS).toBe(30);
    expect(rawIpRetentionCutoff(new Date("2026-06-11T12:00:00.000Z")).toISOString()).toBe(
      "2026-05-12T12:00:00.000Z"
    );
  });

  it("purges raw IP addresses older than the retention window", async () => {
    clickEvent.updateMany.mockResolvedValue({ count: 2 });

    await expect(purgeExpiredRawIpAddresses(new Date("2026-06-11T12:00:00.000Z"))).resolves.toEqual({ count: 2 });
    expect(clickEvent.updateMany).toHaveBeenCalledWith({
      where: {
        ipAddress: { not: null },
        occurredAt: { lt: new Date("2026-05-12T12:00:00.000Z") }
      },
      data: { ipAddress: null }
    });
  });
});
