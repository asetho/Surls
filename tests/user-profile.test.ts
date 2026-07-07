import { describe, expect, it } from "vitest";
import { normalizeMobileMenuSide } from "@/lib/mobile-menu";
import { normalizeUserProfileInput } from "@/lib/user-profile";

describe("user profile input normalization", () => {
  it("normalizes email casing and trims display names", () => {
    expect(normalizeUserProfileInput({ email: "  USER@Example.COM  ", name: "  Test User  " })).toEqual({
      data: {
        displayTimeZone: null,
        email: "user@example.com",
        name: "Test User"
      }
    });
  });

  it("stores blank display names as null", () => {
    expect(normalizeUserProfileInput({ email: "user@example.com", name: "   " })).toEqual({
      data: {
        displayTimeZone: null,
        email: "user@example.com",
        name: null
      }
    });
  });

  it("normalizes optional display timezones", () => {
    expect(
      normalizeUserProfileInput({
        displayTimeZone: "  America/Los_Angeles  ",
        email: "user@example.com",
        name: "User"
      })
    ).toEqual({
      data: {
        displayTimeZone: "America/Los_Angeles",
        email: "user@example.com",
        name: "User"
      }
    });
    expect(
      normalizeUserProfileInput({
        displayTimeZone: "",
        email: "user@example.com",
        name: "User"
      })
    ).toEqual({
      data: {
        displayTimeZone: null,
        email: "user@example.com",
        name: "User"
      }
    });
  });

  it("rejects invalid email addresses and overly long display names", () => {
    expect(normalizeUserProfileInput({ email: "not-an-email", name: "User" })).toEqual({
      error: "Enter a valid email address."
    });
    expect(normalizeUserProfileInput({ email: "user@example.com", name: "x".repeat(121) })).toEqual({
      error: "Display names must be 120 characters or fewer."
    });
    expect(
      normalizeUserProfileInput({ displayTimeZone: "Not/AZone", email: "user@example.com", name: "User" })
    ).toEqual({
      error: "Choose a valid display timezone."
    });
  });

  it("normalizes mobile menu side preferences", () => {
    expect(normalizeMobileMenuSide("left")).toBe("left");
    expect(normalizeMobileMenuSide(" RIGHT ")).toBe("right");
    expect(normalizeMobileMenuSide("bottom")).toBe("right");
    expect(normalizeMobileMenuSide(null)).toBe("right");
  });
});
