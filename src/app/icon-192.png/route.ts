import { faviconRouteResponse } from "@/lib/favicon-routes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return faviconRouteResponse("icon192");
}

export async function HEAD() {
  return faviconRouteResponse("icon192", { method: "HEAD" });
}
