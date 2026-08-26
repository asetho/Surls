import { NextResponse, type NextRequest } from "next/server";
import { isAdminUser, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { csvLine } from "@/lib/csv";
import { appBaseUrl } from "@/lib/env";
import { shortUrl } from "@/lib/links";
import { shortLinkOwnershipWhere } from "@/lib/ownership";

const LINK_EXPORT_PAGE_SIZE = 500;
const JSON_EXPORT_LIMIT = 5000;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const linkOwnership = shortLinkOwnershipWhere(admin);
  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  if (format === "json") {
    if (!isAdminUser(admin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const links = await prisma.shortLink.findMany({
      where: { archivedAt: null, ...linkOwnership },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: JSON_EXPORT_LIMIT + 1
    });
    return NextResponse.json({ links: links.slice(0, JSON_EXPORT_LIMIT), truncated: links.length > JSON_EXPORT_LIMIT });
  }

  let cursor: string | undefined;
  let sentHeader = false;
  const encoder = new TextEncoder();
  const baseUrl = appBaseUrl();
  const stream = new ReadableStream({
    async pull(controller) {
      if (!sentHeader) {
        controller.enqueue(encoder.encode(csvLine(["code", "shortUrl", "destinationUrl", "title", "enabled", "clickCount", "createdAt", "expiresAt"])));
        sentHeader = true;
      }

      const links = await prisma.shortLink.findMany({
        where: { archivedAt: null, ...linkOwnership },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: LINK_EXPORT_PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      });
      if (!links.length) {
        controller.close();
        return;
      }
      cursor = links.at(-1)?.id;
      controller.enqueue(
        encoder.encode(
          links
            .map((link) =>
              csvLine([
                link.code,
                shortUrl(baseUrl, link.code),
                link.destinationUrl,
                link.title,
                link.enabled,
                link.clickCount,
                link.createdAt.toISOString(),
                link.expiresAt?.toISOString() ?? ""
              ])
            )
            .join("")
        )
      );
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="surls-links.csv"'
    }
  });
}
