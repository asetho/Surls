import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rows = await prisma.clickEvent.findMany({
    where: { shortLinkId: id },
    orderBy: { occurredAt: "desc" }
  });
  const csv = toCsv([
    ["timestamp", "id", "country", "ipAddress", "userAgent", "referrer", "browser", "device", "region"],
    ...rows.map((row) => [
      row.occurredAt.toISOString(),
      row.id,
      row.country,
      row.ipAddress,
      row.userAgent,
      row.referrer,
      row.browser,
      row.device,
      row.region
    ])
  ]);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="surls-${id}-stats.csv"`
    }
  });
}
