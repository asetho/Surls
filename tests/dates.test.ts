import { describe, expect, it } from "vitest";
import { buildDailyHistory } from "@/lib/clicks";
import { formatDateTime, isValidTimeZone, requireDisplayTimeZone } from "@/lib/dates";

describe("display timezone helpers", () => {
  it("validates IANA timezones", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(() => requireDisplayTimeZone("Not/AZone")).toThrow(/invalid display timezone/i);
  });

  it("formats admin timestamps in the configured timezone", () => {
    expect(formatDateTime(new Date("2026-06-10T00:42:00.000Z"), "America/New_York")).toBe(
      "Jun 9, 2026 8:42 PM"
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
