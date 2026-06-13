import { webManifestRouteResponse } from "@/lib/favicon-routes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return webManifestRouteResponse();
}

export async function HEAD() {
  return webManifestRouteResponse({ method: "HEAD" });
}
