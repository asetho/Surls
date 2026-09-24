import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  $queryRaw: vi.fn()
}));
const webroot = vi.hoisted(() => ({
  publicWebrootHealthStatus: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma
}));
vi.mock("@/lib/webroot", () => webroot);

import { liveHealthResponse, readyHealthResponse } from "@/lib/health";

describe("health responses", () => {
  beforeEach(() => {
    prisma.$queryRaw.mockReset();
    webroot.publicWebrootHealthStatus.mockReset().mockResolvedValue("ok");
  });

  it("returns a shallow liveness response", async () => {
    const response = liveHealthResponse();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      service: "surls",
      status: "live"
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("returns ready when the database responds", async () => {
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const response = await readyHealthResponse();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      service: "surls",
      status: "ready",
      database: "ok",
      webroot: "ok"
    });
  });

  it("returns not-ready when the database check fails", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("database down"));
    const response = await readyHealthResponse();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      service: "surls",
      status: "not-ready",
      database: "error",
      webroot: "ok"
    });
  });

  it("returns not-ready when the mounted webroot is unreadable", async () => {
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    webroot.publicWebrootHealthStatus.mockResolvedValue("unreadable");

    const response = await readyHealthResponse();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      status: "not-ready",
      database: "ok",
      webroot: "unreadable"
    });
  });

  it("returns not-ready when a configured webroot is missing", async () => {
    vi.stubEnv("PUBLIC_WEBROOT_DIR", "/configured/www");
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    webroot.publicWebrootHealthStatus.mockResolvedValue("missing");

    try {
      const response = await readyHealthResponse();
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({ webroot: "missing" });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("allows the built-in homepage when no webroot is configured", async () => {
    vi.stubEnv("PUBLIC_WEBROOT_DIR", "");
    vi.stubEnv("CUSTOM_PAGES_DIR", "");
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    webroot.publicWebrootHealthStatus.mockResolvedValue("missing");

    try {
      const response = await readyHealthResponse();
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ webroot: "ok" });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
