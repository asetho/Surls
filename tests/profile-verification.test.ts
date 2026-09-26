import { describe, expect, it, vi } from "vitest";
import { decodeProfileVerification, encodeProfileVerification, profileVerificationCookieOptions } from "@/lib/profile-verification";

describe("profile verification proof", () => {
  it("binds a short-lived signed proof to a user and session", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-25T12:00:00Z"));
      const token = encodeProfileVerification("user_1", "session_1", "new@example.com");
      expect(decodeProfileVerification(token)).toMatchObject({ userId: "user_1", sessionId: "session_1", pendingEmail: "new@example.com" });
      expect(decodeProfileVerification(`${token}x`)).toBeNull();
      expect(profileVerificationCookieOptions()).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/admin/profile", maxAge: 300 });
      vi.setSystemTime(new Date("2026-09-25T12:05:01Z"));
      expect(decodeProfileVerification(token)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
