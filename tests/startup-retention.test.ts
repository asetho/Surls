import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const audit = vi.hoisted(() => ({
  startAuditLogPurgeSchedule: vi.fn()
}));

const clicks = vi.hoisted(() => ({
  startClickPrivacyPurgeSchedule: vi.fn()
}));

vi.mock("../src/lib/audit", () => audit);
vi.mock("../src/lib/clicks", () => clicks);

describe("startup retention wiring", () => {
  const originalNextRuntime = process.env.NEXT_RUNTIME;
  const originalNextPhase = process.env.NEXT_PHASE;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_RUNTIME = "";
    process.env.NEXT_PHASE = "";
  });

  afterEach(() => {
    process.env.NEXT_RUNTIME = originalNextRuntime;
    process.env.NEXT_PHASE = originalNextPhase;
  });

  it("starts click and audit retention schedulers during normal runtime registration", async () => {
    const { register } = await import("../instrumentation");

    await register();

    expect(audit.startAuditLogPurgeSchedule).toHaveBeenCalledOnce();
    expect(clicks.startClickPrivacyPurgeSchedule).toHaveBeenCalledOnce();
  });

  it("skips retention schedulers in edge runtime and production builds", async () => {
    const { register } = await import("../instrumentation");

    process.env.NEXT_RUNTIME = "edge";
    await register();
    process.env.NEXT_RUNTIME = "";
    process.env.NEXT_PHASE = "phase-production-build";
    await register();

    expect(audit.startAuditLogPurgeSchedule).not.toHaveBeenCalled();
    expect(clicks.startClickPrivacyPurgeSchedule).not.toHaveBeenCalled();
  });

  it("keeps Docker bootstrap wired to all retention purge steps", async () => {
    const source = await readFile(resolve(process.cwd(), "scripts/bootstrap.mjs"), "utf8");

    expect(source).toContain("await purgeExpiredRawIpAddresses();");
    expect(source).toContain("await purgeExpiredClickEvents();");
    expect(source).toContain("await purgeExpiredAuditLogs();");
  });
});
