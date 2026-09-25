import { webManifestRouteResponse } from "@/lib/favicon-routes";
import { safeManifestStartPath } from "@/lib/manifest-start";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return webManifestRouteResponse({ startPath: safeManifestStartPath(request.nextUrl.searchParams.get("start")) });
}

export async function HEAD(request: NextRequest) {
  return webManifestRouteResponse({ method: "HEAD", startPath: safeManifestStartPath(request.nextUrl.searchParams.get("start")) });
}
