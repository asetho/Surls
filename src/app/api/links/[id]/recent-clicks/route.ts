import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { recentClicksPage, resolveRecentClickPageSize } from "@/lib/clicks";
import { validateCsrfValue } from "@/lib/csrf";
import { resolveDisplayTimeZone } from "@/lib/dates";
import { recentClicksView } from "@/lib/recent-clicks-view";
import { shortLinkOwnershipWhere } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";
import { readJsonBodyWithLimit, requestOriginMatchesApp } from "@/lib/request";
import { getSettings } from "@/lib/settings";

type Params = {
  params: Promise<{ id: string }>;
};

const RECENT_CLICK_PREFERENCE_MAX_BYTES = 1_024;

export async function GET(request: NextRequest, { params }: Params) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const link = await prisma.shortLink.findFirst({
    where: { id, ...shortLinkOwnershipWhere(user) },
    select: { id: true }
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const requestedPageSize = request.nextUrl.searchParams.get("pageSize");
  const pageSize = resolveRecentClickPageSize(requestedPageSize ?? undefined, user.recentClickPageSize);

  const [settings, recent] = await Promise.all([
    getSettings(),
    recentClicksPage(id, {
      page: request.nextUrl.searchParams.get("page"),
      pageSize
    })
  ]);
  const displayTimeZone = resolveDisplayTimeZone(user.displayTimeZone, settings.displayTimeZone);

  return NextResponse.json(recentClicksView(recent.recent, recent.recentPagination, displayTimeZone), {
    headers: { "cache-control": "no-store" }
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requestOriginMatchesApp(request)) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  try {
    validateCsrfValue(request.headers.get("X-Surls-CSRF") ?? "");
  } catch {
    return NextResponse.json({ error: "The form expired. Please refresh and try again." }, { status: 403 });
  }

  const body = await readJsonBodyWithLimit(request, RECENT_CLICK_PREFERENCE_MAX_BYTES);
  if (!body.ok) {
    const status = body.error === "content_type" ? 415 : body.error === "too_large" ? 413 : 400;
    return NextResponse.json({ error: "Invalid preference request." }, { status });
  }
  const submittedPageSize =
    body.value && typeof body.value === "object" && "pageSize" in body.value
      ? body.value.pageSize
      : undefined;
  if (submittedPageSize === undefined) {
    return NextResponse.json({ error: "Invalid page size." }, { status: 400 });
  }

  const { id } = await params;
  const link = await prisma.shortLink.findFirst({
    where: { id, ...shortLinkOwnershipWhere(user) },
    select: { id: true }
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pageSize = resolveRecentClickPageSize(submittedPageSize, user.recentClickPageSize);
  await prisma.user.update({
    where: { id: user.id },
    data: { recentClickPageSize: pageSize }
  });

  return NextResponse.json({ pageSize }, { headers: { "cache-control": "no-store" } });
}
