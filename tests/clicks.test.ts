import { beforeEach, describe, expect, it, vi } from "vitest";

const clickEvent = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  updateMany: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { clickEvent }
}));

import {
  CLICK_EVENT_RETENTION_DAYS,
  DEFAULT_RECENT_CLICK_PAGE_SIZE,
  MAX_RECENT_CLICK_PAGE_SIZE,
  RAW_IP_RETENTION_DAYS,
  clickEventRetentionCutoff,
  normalizeRecentClickPage,
  normalizeRecentClickPageSize,
  purgeExpiredClickEvents,
  purgeExpiredRawIpAddresses,
  rawIpRetentionCutoff
} from "@/lib/clicks";

beforeEach(() => {
  clickEvent.deleteMany.mockReset();
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

  it("uses a configurable click event retention cutoff", () => {
    expect(CLICK_EVENT_RETENTION_DAYS).toBe(365);
    expect(clickEventRetentionCutoff(new Date("2026-06-11T12:00:00.000Z")).toISOString()).toBe(
      "2025-06-11T12:00:00.000Z"
    );
  });

  it("purges click events older than the retention window", async () => {
    clickEvent.deleteMany.mockResolvedValue({ count: 4 });

    await expect(purgeExpiredClickEvents(new Date("2026-06-11T12:00:00.000Z"))).resolves.toEqual({ count: 4 });
    expect(clickEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        occurredAt: { lt: new Date("2025-06-11T12:00:00.000Z") }
      }
    });
  });
});
