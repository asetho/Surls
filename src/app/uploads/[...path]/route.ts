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

function downloadResponse(response: Response | null, method: "GET" | "HEAD") {
  if (!response) return notFound(method);
  response.headers.set("Content-Disposition", "attachment");
  return response;
}

export async function GET(_request: Request, { params }: Params) {
  const { path } = await params;
  return downloadResponse(await publicWebrootResponse(path, { allowReservedPath: true, rootDir: env.UPLOADS_DIR }), "GET");
}

export async function HEAD(_request: Request, { params }: Params) {
  const { path } = await params;
  return downloadResponse(
    await publicWebrootResponse(path, { allowReservedPath: true, method: "HEAD", rootDir: env.UPLOADS_DIR }),
    "HEAD"
  );
}
