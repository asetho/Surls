import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { recentClicksPage } from "@/lib/clicks";
import { recentClicksView } from "@/lib/recent-clicks-view";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const link = await prisma.shortLink.findUnique({
    where: { id },
    select: { id: true }
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ displayTimeZone }, recent] = await Promise.all([
    getSettings(),
    recentClicksPage(id, {
      page: request.nextUrl.searchParams.get("page"),
      pageSize: request.nextUrl.searchParams.get("pageSize")
    })
  ]);

  return NextResponse.json(recentClicksView(recent.recent, recent.recentPagination, displayTimeZone), {
    headers: { "cache-control": "no-store" }
  });
}
