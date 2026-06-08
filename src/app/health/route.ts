import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, app: "Surls", database: "ok" });
  } catch {
    return NextResponse.json({ ok: false, app: "Surls", database: "error" }, { status: 503 });
  }
}
