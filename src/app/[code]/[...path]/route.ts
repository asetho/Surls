import { publicWebrootNotFoundResponse, publicWebrootResponse } from "@/lib/webroot";

type Params = {
  params: Promise<{ code: string; path: string[] }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: Params) {
  const { code, path } = await params;
  return (await publicWebrootResponse([code, ...path])) ?? publicWebrootNotFoundResponse();
}

export async function HEAD(_request: Request, { params }: Params) {
  const { code, path } = await params;
  return (
    (await publicWebrootResponse([code, ...path], { method: "HEAD" })) ?? publicWebrootNotFoundResponse({ method: "HEAD" })
  );
}
