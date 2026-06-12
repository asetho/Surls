import { publicWebrootResponse } from "@/lib/webroot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { path } = await params;
  return (await publicWebrootResponse(["assets", ...path])) ?? new Response("Not found", { status: 404 });
}

export async function HEAD(_request: Request, { params }: RouteContext) {
  const { path } = await params;
  return (await publicWebrootResponse(["assets", ...path], { method: "HEAD" })) ?? new Response(null, { status: 404 });
}
