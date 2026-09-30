import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCsrfToken } from "@/lib/csrf";

const scheduled = vi.hoisted(() => [] as Array<() => Promise<void>>);
const reset = vi.hoisted(() => ({
  passwordResetAvailable: vi.fn(async () => true),
  requestPasswordReset: vi.fn(async (email: string) => { void email; }),
  completePasswordReset: vi.fn(async (token: string, password: string) => {
    void token; void password; return "success" as const;
  })
}));
const rate = vi.hoisted(() => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }));
const turnstile = vi.hoisted(() => ({ verifyTurnstileChallenge: vi.fn(async () => ({ ok: true })) }));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => Promise<void>) => { scheduled.push(callback); }
}));
vi.mock("@/lib/password-reset", () => ({ ...reset, PASSWORD_RESET_GENERIC_MESSAGE: "If this account can reset its password, an email will arrive shortly." }));
vi.mock("@/lib/rate-limit", () => rate);
vi.mock("@/lib/turnstile", () => turnstile);

function request(email = "admin@example.com", origin = "http://localhost:3000") {
  const form = new FormData();
  form.set("csrf", getCsrfToken());
  form.set("email", email);
  return new NextRequest("http://localhost:3000/api/auth/password-reset/request", {
    method: "POST", headers: { origin }, body: form
  });
}

function completionRequest(password: string, confirmation = password, csrf = getCsrfToken()) {
  const form = new FormData();
  form.set("csrf", csrf);
  form.set("token", "A".repeat(43));
  form.set("password", password);
  form.set("confirmPassword", confirmation);
  return new NextRequest("http://localhost:3000/api/auth/password-reset/complete", {
    method: "POST", headers: { origin: "http://localhost:3000" }, body: form
  });
}

describe("password reset requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scheduled.length = 0;
    reset.passwordResetAvailable.mockResolvedValue(true);
    rate.checkRateLimit.mockResolvedValue({ allowed: true });
    turnstile.verifyTurnstileChallenge.mockResolvedValue({ ok: true });
    reset.completePasswordReset.mockResolvedValue("success");
  });

  it("returns a generic response and schedules delivery without blocking the response", async () => {
    const { POST } = await import("@/app/api/auth/password-reset/request/route");
    const response = await POST(request("ADMIN@example.com"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/forgot-password?sent=1");
    expect(reset.requestPasswordReset).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);
    await scheduled[0]();
    expect(reset.requestPasswordReset).toHaveBeenCalledWith("admin@example.com");
  });

  it("does not schedule delivery when recovery is disabled or throttled", async () => {
    const { POST } = await import("@/app/api/auth/password-reset/request/route");
    reset.passwordResetAvailable.mockResolvedValueOnce(false);
    expect((await POST(request())).headers.get("location")).toBe("http://localhost:3000/forgot-password?sent=1");
    rate.checkRateLimit.mockResolvedValue({ allowed: false });
    expect((await POST(request())).headers.get("location")).toBe("http://localhost:3000/forgot-password?sent=1");
    expect(scheduled).toHaveLength(0);
  });

  it("requires a same-origin form and a successful security check", async () => {
    const { POST } = await import("@/app/api/auth/password-reset/request/route");
    expect((await POST(request("admin@example.com", "https://other.example"))).headers.get("location"))
      .toBe("http://localhost:3000/forgot-password?error=form");
    turnstile.verifyTurnstileChallenge.mockResolvedValueOnce({ ok: false });
    expect((await POST(request())).headers.get("location"))
      .toBe("http://localhost:3000/forgot-password?error=check");
    expect(scheduled).toHaveLength(0);
  });
});

describe("password reset completion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rate.checkRateLimit.mockResolvedValue({ allowed: true });
  });

  it("rejects expired forms and mismatched passwords before changing credentials", async () => {
    const { POST } = await import("@/app/api/auth/password-reset/complete/route");
    expect((await POST(completionRequest("a long new password", undefined, "expired"))).headers.get("location"))
      .toContain("error=form");
    expect((await POST(completionRequest("a long new password", "different password"))).headers.get("location"))
      .toContain("error=password");
    expect(reset.completePasswordReset).not.toHaveBeenCalled();
  });

  it("completes a valid reset and removes the token from the redirect URL", async () => {
    const { POST } = await import("@/app/api/auth/password-reset/complete/route");
    const response = await POST(completionRequest("a long new password"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/reset-password?done=1");
    expect(reset.completePasswordReset).toHaveBeenCalledWith("A".repeat(43), "a long new password");
  });
});
