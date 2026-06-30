import { env } from "@/lib/env";
import { publicWebrootResponse } from "@/lib/webroot";

type Params = {
  params: Promise<{ path: string[] }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function notFound(method: "GET" | "HEAD") {
  return new Response(method === "HEAD" ? null : "Not found", {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    },
    status: 404
  });
}

export async function GET(_request: Request, { params }: Params) {
  const { path } = await params;
  return (await publicWebrootResponse(path, { allowReservedPath: true, rootDir: env.UPLOADS_DIR })) ?? notFound("GET");
}

export async function HEAD(_request: Request, { params }: Params) {
  const { path } = await params;
  return (await publicWebrootResponse(path, { allowReservedPath: true, method: "HEAD", rootDir: env.UPLOADS_DIR })) ?? notFound("HEAD");
}
