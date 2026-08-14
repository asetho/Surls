import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { uploadedFileUrl } from "@/lib/uploads";
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

async function activeUploadExists(path: string[]) {
  if (path.length !== 1 || !path[0]) return false;
  const link = await prisma.shortLink.findFirst({
    where: {
      archivedAt: null,
      destinationUrl: uploadedFileUrl(path[0]),
      enabled: true
    },
    select: { id: true }
  });
  return Boolean(link);
}

export async function GET(_request: Request, { params }: Params) {
  const { path } = await params;
  if (!(await activeUploadExists(path))) return notFound("GET");
  return downloadResponse(
    await publicWebrootResponse(path, {
      allowReservedPath: true,
      cacheControl: "private, no-store",
      rootDir: env.UPLOADS_DIR
    }),
    "GET"
  );
}

export async function HEAD(_request: Request, { params }: Params) {
  const { path } = await params;
  if (!(await activeUploadExists(path))) return notFound("HEAD");
  return downloadResponse(
    await publicWebrootResponse(path, {
      allowReservedPath: true,
      cacheControl: "private, no-store",
      method: "HEAD",
      rootDir: env.UPLOADS_DIR
    }),
    "HEAD"
  );
}
