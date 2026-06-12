import { publicWebrootNotFoundResponse, publicWebrootResponse } from "@/lib/webroot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return (await publicWebrootResponse(["privacy"])) ?? publicWebrootNotFoundResponse();
}

export async function HEAD() {
  return (await publicWebrootResponse(["privacy"], { method: "HEAD" })) ?? publicWebrootNotFoundResponse({ method: "HEAD" });
}
