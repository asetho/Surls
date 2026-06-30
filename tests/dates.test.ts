import { describe, expect, it } from "vitest";
import { buildDailyHistory } from "@/lib/clicks";
import {
  DEFAULT_DISPLAY_TIME_ZONE,
  formatDateTime,
  isValidTimeZone,
  normalizeOptionalDisplayTimeZone,
  requireDisplayTimeZone,
  resolveDisplayTimeZone,
  startOfDayInTimeZone
} from "@/lib/dates";

describe("display timezone helpers", () => {
  it("validates IANA timezones", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(() => requireDisplayTimeZone("Not/AZone")).toThrow(/invalid display timezone/i);
  });

  it("normalizes optional user timezones without forcing a default", () => {
    expect(normalizeOptionalDisplayTimeZone("  America/Los_Angeles  ")).toBe("America/Los_Angeles");
    expect(normalizeOptionalDisplayTimeZone("")).toBeNull();
    expect(normalizeOptionalDisplayTimeZone("Not/AZone")).toBeNull();
  });

  it("resolves viewer timezones from user preference, site default, then hardcoded fallback", () => {
    expect(resolveDisplayTimeZone("America/Los_Angeles", "America/New_York")).toBe("America/Los_Angeles");
    expect(resolveDisplayTimeZone(null, "America/New_York")).toBe("America/New_York");
    expect(resolveDisplayTimeZone("Not/AZone", "UTC")).toBe("UTC");
    expect(resolveDisplayTimeZone(null, "Not/AZone")).toBe(DEFAULT_DISPLAY_TIME_ZONE);
  });

  it("formats admin timestamps in the configured timezone", () => {
    expect(formatDateTime(new Date("2026-06-10T00:42:00.000Z"), "America/New_York")).toBe(
      "06/09/26 8:42:00 PM"
    );
  });

  it("finds the UTC instant for a viewer-local day start", () => {
    expect(startOfDayInTimeZone(new Date("2026-06-10T04:30:00.000Z"), "America/New_York").toISOString()).toBe(
      "2026-06-10T04:00:00.000Z"
    );
  });

  it("buckets daily click history by configured timezone", () => {
    const history = buildDailyHistory(
      new Date("2026-06-09T12:00:00.000Z"),
      [
        { occurredAt: new Date("2026-06-10T00:42:00.000Z") },
        { occurredAt: new Date("2026-06-10T04:30:00.000Z") }
      ],
      "America/New_York",
      new Date("2026-06-10T05:00:00.000Z")
    );

    expect(history).toEqual([
      { date: "2026-06-09", count: 1 },
      { date: "2026-06-10", count: 1 }
    ]);
  });
});
