import { publicWebrootNotFoundResponse, publicWebrootResponse } from "@/lib/webroot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return (await publicWebrootResponse(["cookies"])) ?? publicWebrootNotFoundResponse();
}

export async function HEAD() {
  return (await publicWebrootResponse(["cookies"], { method: "HEAD" })) ?? publicWebrootNotFoundResponse({ method: "HEAD" });
}
