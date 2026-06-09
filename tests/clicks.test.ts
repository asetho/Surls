import { describe, expect, it } from "vitest";
import {
  DEFAULT_RECENT_CLICK_PAGE_SIZE,
  MAX_RECENT_CLICK_PAGE_SIZE,
  normalizeRecentClickPage,
  normalizeRecentClickPageSize
} from "@/lib/clicks";

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
});
