import { publicWebrootResponse } from "@/lib/webroot";

export const runtime = "nodejs";

export async function GET() {
  return (await publicWebrootResponse(["favicon.ico"])) ?? new Response("Not found", { status: 404 });
}

export async function HEAD() {
  return (await publicWebrootResponse(["favicon.ico"], { method: "HEAD" })) ?? new Response(null, { status: 404 });
}
