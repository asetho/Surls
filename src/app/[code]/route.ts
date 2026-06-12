import type { NextRequest } from "next/server";
import { handleShortRedirect } from "@/lib/redirect";
import { isBlockedPublicWebrootPath, publicWebrootNotFoundResponse, publicWebrootResponse } from "@/lib/webroot";

type Params = {
  params: Promise<{ code: string }>;
};

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: Params) {
  const { code } = await params;
  const webrootResponse = await publicWebrootResponse([code]);
  if (webrootResponse) return webrootResponse;
  if (isBlockedPublicWebrootPath([code])) return publicWebrootNotFoundResponse({ method: "GET" });
  return handleShortRedirect(request, code);
}

export async function HEAD(request: NextRequest, { params }: Params) {
  const { code } = await params;
  const webrootResponse = await publicWebrootResponse([code], { method: "HEAD" });
  if (webrootResponse) return webrootResponse;
  if (isBlockedPublicWebrootPath([code])) return publicWebrootNotFoundResponse({ method: "HEAD" });
  return handleShortRedirect(request, code, true);
}
