import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  $queryRaw: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma
}));

import { liveHealthResponse, readyHealthResponse } from "@/lib/health";

describe("health responses", () => {
  beforeEach(() => {
    prisma.$queryRaw.mockReset();
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
      database: "ok"
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
      database: "error"
    });
  });
});
