import { defaultHomepageResponse } from "@/lib/default-homepage";
import { publicWebrootResponse } from "@/lib/webroot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return (await publicWebrootResponse([])) ?? defaultHomepageResponse();
}

export async function HEAD() {
  return (await publicWebrootResponse([], { method: "HEAD" })) ?? defaultHomepageResponse("HEAD");
}
