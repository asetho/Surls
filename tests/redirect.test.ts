import { describe, expect, it } from "vitest";
import { shouldRecordRedirectClick } from "@/lib/redirect";
import { linkUnavailableReason } from "@/lib/links";

describe("redirect behavior", () => {
  it("does not record authenticated admin clicks by default", () => {
    expect(shouldRecordRedirectClick({ isHead: false, isAdminClick: true, trackAdminClicks: false })).toBe(false);
  });

  it("records admin clicks only when explicitly enabled", () => {
    expect(shouldRecordRedirectClick({ isHead: false, isAdminClick: true, trackAdminClicks: true })).toBe(true);
  });

  it("records normal visitor clicks and skips HEAD probes", () => {
    expect(shouldRecordRedirectClick({ isHead: false, isAdminClick: false, trackAdminClicks: false })).toBe(true);
    expect(shouldRecordRedirectClick({ isHead: true, isAdminClick: false, trackAdminClicks: true })).toBe(false);
  });

  it("handles disabled, expired, archived, and max-click links", () => {
    const base = { enabled: true, archivedAt: null, expiresAt: null, maxClicks: null, clickCount: 0 };
    expect(linkUnavailableReason(base)).toBeNull();
    expect(linkUnavailableReason({ ...base, enabled: false })).toMatch(/disabled/i);
    expect(linkUnavailableReason({ ...base, archivedAt: new Date() })).toMatch(/archived/i);
    expect(linkUnavailableReason({ ...base, expiresAt: new Date(Date.now() - 1000) })).toMatch(/expired/i);
    expect(linkUnavailableReason({ ...base, maxClicks: 3, clickCount: 3 })).toMatch(/click limit/i);
  });
});
