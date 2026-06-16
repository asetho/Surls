import { NextResponse, type NextRequest } from "next/server";
import { isAdminUser, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { csvLine } from "@/lib/csv";

type Params = {
  params: Promise<{ id: string }>;
};

const STATS_EXPORT_PAGE_SIZE = 500;

export async function GET(_request: NextRequest, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canViewRawIpAddresses = isAdminUser(admin);
  const { id } = await params;
  let cursor: string | undefined;
  let sentHeader = false;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async pull(controller) {
      if (!sentHeader) {
        controller.enqueue(encoder.encode(csvLine(["timestamp", "id", "country", "ipAddress", "userAgent", "referrer", "browser", "device", "region"])));
        sentHeader = true;
      }

      const rows = await prisma.clickEvent.findMany({
        where: { shortLinkId: id },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: STATS_EXPORT_PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      });
      if (!rows.length) {
        controller.close();
        return;
      }
      cursor = rows.at(-1)?.id;
      controller.enqueue(
        encoder.encode(
          rows
            .map((row) =>
              csvLine([
                row.occurredAt.toISOString(),
                row.id,
                row.country,
                canViewRawIpAddresses ? row.ipAddress : row.ipAddress ? "Hidden" : null,
                row.userAgent,
                row.referrer,
                row.browser,
                row.device,
                row.region
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
      "content-disposition": `attachment; filename="surls-${id}-stats.csv"`
    }
  });
}
