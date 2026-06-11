import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fetchPageTitle } from "@/lib/page-title";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rate = await checkRateLimit(`title:${admin.id}`, 30, 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const url = request.nextUrl.searchParams.get("url") ?? "";
  if (!url.trim()) return NextResponse.json({ title: null });

  const title = await fetchPageTitle(url);
  return NextResponse.json({ title });
}
