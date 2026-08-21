import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
const rateLimit = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const aliases = vi.hoisted(() => ({ checkUploadShortCodeAvailability: vi.fn() }));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/rate-limit", () => rateLimit);
vi.mock("@/lib/upload-and-shorten", () => aliases);

function request(code = "project-docs") {
  return new NextRequest(`http://localhost:3000/api/links/availability?code=${encodeURIComponent(code)}`);
}

describe("GET /api/links/availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAdmin.mockResolvedValue({ id: "user_123" });
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true });
  });

  it("requires an authenticated admin session", async () => {
    auth.requireAdmin.mockResolvedValue(null);
    const { GET } = await import("@/app/api/links/availability/route");

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(aliases.checkUploadShortCodeAvailability).not.toHaveBeenCalled();
  });

  it("returns the shared alias availability result", async () => {
    aliases.checkUploadShortCodeAvailability.mockResolvedValue({ available: true, error: null });
    const { GET } = await import("@/app/api/links/availability/route");

    const response = await GET(request("project-docs"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ available: true, error: null });
    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith("alias-availability:user_123", 120, 60_000);
    expect(aliases.checkUploadShortCodeAvailability).toHaveBeenCalledWith("project-docs");
  });

  it("returns validation and collision failures as unavailable", async () => {
    aliases.checkUploadShortCodeAvailability.mockResolvedValue({
      available: false,
      error: "That short alias is already in use."
    });
    const { GET } = await import("@/app/api/links/availability/route");

    const response = await GET(request("existing"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      available: false,
      error: "That short alias is already in use."
    });
  });

  it("rejects blank and rate-limited checks", async () => {
    const { GET } = await import("@/app/api/links/availability/route");
    expect((await GET(request(" "))).status).toBe(400);

    rateLimit.checkRateLimit.mockResolvedValue({ allowed: false });
    expect((await GET(request())).status).toBe(429);
    expect(aliases.checkUploadShortCodeAvailability).not.toHaveBeenCalled();
  });
});
