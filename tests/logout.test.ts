import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCsrfToken } from "@/lib/csrf";

const auth = vi.hoisted(() => ({
  clearSessionCookie: vi.fn((response: NextResponse) => {
    response.cookies.set("surls_session", "", { expires: new Date(0), path: "/" });
  }),
  destroySession: vi.fn()
}));

const audit = vi.hoisted(() => ({
  auditLog: vi.fn()
}));

vi.mock("@/lib/auth", () => ({
  clearSessionCookie: auth.clearSessionCookie,
  destroySession: auth.destroySession,
  SESSION_COOKIE: "surls_session"
}));

vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/request", () => ({ requestOriginMatchesApp: (request: NextRequest) => request.headers.get("origin") === "http://localhost:3000" }));

function logoutRequest(cookie?: string, csrf = getCsrfToken(), origin = "http://localhost:3000") {
  const formData = new FormData();
  formData.set("csrf", csrf);
  return new NextRequest("http://localhost:3000/api/auth/logout", {
    body: formData,
    headers: { origin, ...(cookie ? { cookie } : {}) },
    method: "POST"
  });
}

describe("logout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears the session and redirects to the admin login page", async () => {
    const { POST } = await import("@/app/api/auth/logout/route");

    const response = await POST(logoutRequest("surls_session=session-token"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin");
    expect(auth.destroySession).toHaveBeenCalledWith("session-token");
    expect(auth.clearSessionCookie).toHaveBeenCalledWith(response);
    expect(response.headers.get("set-cookie")).toContain("surls_session=");
    expect(audit.auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "LOGOUT" }));
  });

  it("rejects cross-origin and invalid-CSRF logout requests", async () => {
    const { POST } = await import("@/app/api/auth/logout/route");

    await expect(POST(logoutRequest("surls_session=session-token", getCsrfToken(), "https://attacker.example"))).resolves.toMatchObject({ status: 403 });
    await expect(POST(logoutRequest("surls_session=session-token", "invalid"))).resolves.toMatchObject({ status: 403 });

    expect(auth.destroySession).not.toHaveBeenCalled();
  });
});
