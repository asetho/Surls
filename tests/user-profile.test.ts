import { describe, expect, it } from "vitest";
import { normalizeUserProfileInput } from "@/lib/user-profile";

describe("user profile input normalization", () => {
  it("normalizes email casing and trims display names", () => {
    expect(normalizeUserProfileInput({ email: "  USER@Example.COM  ", name: "  Test User  " })).toEqual({
      data: {
        email: "user@example.com",
        name: "Test User"
      }
    });
  });

  it("stores blank display names as null", () => {
    expect(normalizeUserProfileInput({ email: "user@example.com", name: "   " })).toEqual({
      data: {
        email: "user@example.com",
        name: null
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
  });
});
