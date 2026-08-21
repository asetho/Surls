import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkUploadShortCodeAvailability } from "@/lib/upload-and-shorten";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const code = request.nextUrl.searchParams.get("code")?.trim() ?? "";
  if (!code) return NextResponse.json({ error: "Enter an alias." }, { status: 400 });

  const rate = await checkRateLimit(`alias-availability:${admin.id}`, 120, 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  try {
    return NextResponse.json(await checkUploadShortCodeAvailability(code));
  } catch {
    return NextResponse.json({ error: "Could not check alias availability." }, { status: 500 });
  }
}
