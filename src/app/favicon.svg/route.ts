import { faviconRouteResponse } from "@/lib/favicon-routes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return faviconRouteResponse("faviconSvg");
}

export async function HEAD() {
  return faviconRouteResponse("faviconSvg", { method: "HEAD" });
}
