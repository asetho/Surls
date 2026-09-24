import { describe, expect, it, vi } from "vitest";
import {
  decodeExternalAuth, encodeExternalAuth, externalCallbackUrl,
  newExternalAuthValues
} from "@/lib/external-auth";

describe("external sign-in state", () => {
  it("signs the provider, user connection, and safe return path", () => {
    const values = newExternalAuthValues();
    const cookie = encodeExternalAuth({ provider: "google", ...values, nextPath: "//evil.example", userId: "user_1" });
    expect(decodeExternalAuth(cookie)).toMatchObject({ provider: "google", ...values, nextPath: "/admin", userId: "user_1" });
    expect(decodeExternalAuth(`${cookie}x`)).toBeNull();
    expect(externalCallbackUrl("google")).toBe("http://localhost:3000/api/auth/external/google/callback");
  });

  it("expires pending provider state after ten minutes", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-24T12:00:00Z"));
      const cookie = encodeExternalAuth({ provider: "github", ...newExternalAuthValues(), nextPath: "/admin", userId: null });
      vi.setSystemTime(new Date("2026-09-24T12:10:01Z"));
      expect(decodeExternalAuth(cookie)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
