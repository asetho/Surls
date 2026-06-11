import { NextResponse } from "next/server";
import { prisma } from "./prisma";

export function liveHealthResponse() {
  return NextResponse.json({
    ok: true,
    service: "surls",
    app: "Surls",
    status: "live"
  });
}

export async function readyHealthResponse() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      service: "surls",
      app: "Surls",
      status: "ready",
      database: "ok"
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        service: "surls",
        app: "Surls",
        status: "not-ready",
        database: "error"
      },
      { status: 503 }
    );
  }
}
