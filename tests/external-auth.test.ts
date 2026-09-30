import { describe, expect, it, vi } from "vitest";
import {
  decodeExternalAuth, encodeExternalAuth, externalCallbackUrl,
  newExternalAuthValues
} from "@/lib/external-auth";

describe("external sign-in state", () => {
  it("signs the provider, verified connection, session, and safe return path", () => {
    const values = newExternalAuthValues();
    const cookie = encodeExternalAuth({ provider: "google", ...values, nextPath: "//evil.example", userId: "user_1", sessionId: "session_1", purpose: "connect" });
    expect(decodeExternalAuth(cookie)).toMatchObject({ provider: "google", ...values, nextPath: "/admin", userId: "user_1", sessionId: "session_1", purpose: "connect" });
    expect(decodeExternalAuth(`${cookie}x`)).toBeNull();
    expect(externalCallbackUrl("google")).toBe("http://localhost:3000/api/auth/external/google/callback");
  });

  it("rejects legacy and unknown-purpose signed connection state", () => {
    const values = newExternalAuthValues();
    expect(decodeExternalAuth(encodeExternalAuth({ provider: "google", ...values, nextPath: "/admin/profile", userId: "user_1" }))).toBeNull();
    expect(decodeExternalAuth(encodeExternalAuth({ provider: "google", ...values, nextPath: "/admin/profile", userId: "user_1", sessionId: "session_1", purpose: "other" as "connect" }))).toBeNull();
    expect(decodeExternalAuth(encodeExternalAuth({ provider: "google", ...values, nextPath: "/admin/profile", userId: "user_1", purpose: "connect" }))).toBeNull();
    expect(decodeExternalAuth(encodeExternalAuth({ provider: "google", ...values, nextPath: "/admin/profile", userId: "", sessionId: "session_1", purpose: "connect" }))).toBeNull();
    expect(decodeExternalAuth(encodeExternalAuth({ provider: "google", ...values, nextPath: "/admin", userId: null, sessionId: "session_1", purpose: "connect" }))).toBeNull();
  });

  it("requires a target provider for provider-backed Connect proof", () => {
    const values = newExternalAuthValues();
    expect(decodeExternalAuth(encodeExternalAuth({ provider: "github", ...values, nextPath: "/admin/profile", userId: "user_1", sessionId: "session_1", purpose: "verify-connect" }))).toBeNull();
    expect(decodeExternalAuth(encodeExternalAuth({ provider: "github", ...values, nextPath: "/admin/profile", userId: "user_1", sessionId: "session_1", purpose: "verify-connect", targetProvider: "oidc-asetho-link" })))
      .toMatchObject({ purpose: "verify-connect", targetProvider: "oidc-asetho-link" });
  });

  it("keeps TOTP-setup provider proof distinct from Connect", () => {
    const values = newExternalAuthValues();
    const cookie = encodeExternalAuth({ provider: "github", ...values, nextPath: "/admin/profile", userId: "user_1",
      sessionId: "session_1", purpose: "verify-totp-setup" });
    expect(decodeExternalAuth(cookie)).toMatchObject({ provider: "github", userId: "user_1", sessionId: "session_1", purpose: "verify-totp-setup" });
    expect(decodeExternalAuth(encodeExternalAuth({ provider: "github", ...values, nextPath: "/admin/profile", userId: "user_1",
      sessionId: "session_1", purpose: "verify-totp-setup", targetProvider: "google" }))).toBeNull();
  });

  it("preserves a named provider profile in the signed callback state", () => {
    const values = newExternalAuthValues();
    const cookie = encodeExternalAuth({ provider: "oidc-asetho-link", ...values, nextPath: "/admin", userId: null });
    expect(decodeExternalAuth(cookie)?.provider).toBe("oidc-asetho-link");
    expect(externalCallbackUrl("oidc-asetho-link")).toBe("http://localhost:3000/api/auth/external/oidc-asetho-link/callback");
  });

  it("binds reauthentication to a signed session", () => {
    const cookie = encodeExternalAuth({ provider: "oidc-asetho-link", ...newExternalAuthValues(), nextPath: "/admin/profile",
      userId: "user_1", purpose: "reauth", sessionId: "session_1", verificationAction: "email-change", pendingEmail: "new@example.com" });
    expect(decodeExternalAuth(cookie)).toMatchObject({ purpose: "reauth", userId: "user_1", sessionId: "session_1" });
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

  it("preserves a distinct provider profile in signed callback state", () => {
    const key = "oidc--11111111-1111-4111-8111-111111111111";
    const cookie = encodeExternalAuth({ provider: key, ...newExternalAuthValues(), nextPath: "/admin", userId: null });
    expect(decodeExternalAuth(cookie)?.provider).toBe(key);
    expect(externalCallbackUrl(key)).toBe(`http://localhost:3000/api/auth/external/${key}/callback`);
  });
});
