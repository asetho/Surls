import { faviconRouteResponse } from "@/lib/favicon-routes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return faviconRouteResponse("appleTouchIcon");
}

export async function HEAD() {
  return faviconRouteResponse("appleTouchIcon", { method: "HEAD" });
}
