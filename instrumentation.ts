export async function register() {
  if (process.env.NEXT_RUNTIME === "edge" || process.env.NEXT_PHASE === "phase-production-build") return;
  const [{ startAuditLogPurgeSchedule }, { startClickPrivacyPurgeSchedule }] = await Promise.all([
    import("./src/lib/audit"),
    import("./src/lib/clicks")
  ]);
  startAuditLogPurgeSchedule();
  startClickPrivacyPurgeSchedule();
}
