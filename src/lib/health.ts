import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { publicWebrootHealthStatus } from "./webroot";

export function liveHealthResponse() {
  return NextResponse.json({
    ok: true,
    service: "surls",
    app: "Surls",
    status: "live"
  });
}

export async function readyHealthResponse() {
  let database: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  const webrootStatus = await publicWebrootHealthStatus();
  const webrootConfigured = Boolean(process.env.PUBLIC_WEBROOT_DIR?.trim() || process.env.CUSTOM_PAGES_DIR?.trim());
  const webroot = webrootStatus === "missing" && !webrootConfigured ? "ok" : webrootStatus;
  const ready = database === "ok" && webroot === "ok";

  return NextResponse.json(
    {
      ok: ready,
      service: "surls",
      app: "Surls",
      status: ready ? "ready" : "not-ready",
      database,
      webroot
    },
    { status: ready ? 200 : 503 }
  );
}
