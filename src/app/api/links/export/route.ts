import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { appBaseUrl } from "@/lib/env";
import { shortUrl } from "@/lib/links";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const links = await prisma.shortLink.findMany({ where: { archivedAt: null }, orderBy: { createdAt: "desc" } });
  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  if (format === "json") {
    return NextResponse.json({ links });
  }
  const csv = toCsv([
    ["code", "shortUrl", "destinationUrl", "title", "enabled", "clickCount", "createdAt", "expiresAt"],
    ...links.map((link) => [
      link.code,
      shortUrl(appBaseUrl(), link.code),
      link.destinationUrl,
      link.title,
      link.enabled,
      link.clickCount,
      link.createdAt.toISOString(),
      link.expiresAt?.toISOString() ?? ""
    ])
  ]);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="surls-links.csv"'
    }
  });
}
