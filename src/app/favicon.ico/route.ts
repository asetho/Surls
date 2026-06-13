import { faviconRouteResponse } from "@/lib/favicon-routes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return faviconRouteResponse("faviconIco");
}

export async function HEAD() {
  return faviconRouteResponse("faviconIco", { method: "HEAD" });
}
