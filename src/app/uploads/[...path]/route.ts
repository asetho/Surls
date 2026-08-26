import { env } from "@/lib/env";
import { hasValidUploadDownloadGrant } from "@/lib/upload-grants";
import { uploadedFileDownloadName } from "@/lib/uploaded-file-records";
import { uploadContentDisposition } from "@/lib/uploads";
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

function downloadResponse(response: Response | null, method: "GET" | "HEAD", downloadName: string | null) {
  if (!response) return notFound(method);
  response.headers.set("Content-Disposition", uploadContentDisposition(downloadName));
  return response;
}

async function authorizedUpload(request: Request, path: string[], method: "GET" | "HEAD") {
  if (path.length !== 1 || !path[0]) return null;
  if (!(await hasValidUploadDownloadGrant(request, path[0], method))) return null;
  return { downloadName: await uploadedFileDownloadName(path[0]), filename: path[0] };
}

export async function GET(request: Request, { params }: Params) {
  const { path } = await params;
  const upload = await authorizedUpload(request, path, "GET");
  if (!upload) return notFound("GET");
  return downloadResponse(
    await publicWebrootResponse(path, {
      allowReservedPath: true,
      cacheControl: "private, no-store",
      rootDir: env.UPLOADS_DIR
    }),
    "GET",
    upload.downloadName
  );
}

export async function HEAD(request: Request, { params }: Params) {
  const { path } = await params;
  const upload = await authorizedUpload(request, path, "HEAD");
  if (!upload) return notFound("HEAD");
  return downloadResponse(
    await publicWebrootResponse(path, {
      allowReservedPath: true,
      cacheControl: "private, no-store",
      method: "HEAD",
      rootDir: env.UPLOADS_DIR
    }),
    "HEAD",
    upload.downloadName
  );
}
