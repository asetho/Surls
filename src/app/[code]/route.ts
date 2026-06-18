import type { NextRequest } from "next/server";
import { handleShortRedirect } from "@/lib/redirect";
import { isBlockedPublicWebrootPath, publicWebrootNotFoundResponse, publicWebrootResponse } from "@/lib/webroot";

type Params = {
  params: Promise<{ code: string }>;
};

export const runtime = "nodejs";

async function publicWebrootFallback(code: string, method: "GET" | "HEAD") {
  return (
    (await publicWebrootResponse([code], { method })) ??
    publicWebrootNotFoundResponse({ method })
  );
}

export async function GET(request: NextRequest, { params }: Params) {
  const { code } = await params;
  if (isBlockedPublicWebrootPath([code])) return publicWebrootNotFoundResponse({ method: "GET" });
  return handleShortRedirect(request, code, false, {
    missingLinkResponse: () => publicWebrootFallback(code, "GET")
  });
}

export async function HEAD(request: NextRequest, { params }: Params) {
  const { code } = await params;
  if (isBlockedPublicWebrootPath([code])) return publicWebrootNotFoundResponse({ method: "HEAD" });
  return handleShortRedirect(request, code, true, {
    missingLinkResponse: () => publicWebrootFallback(code, "HEAD")
  });
}
