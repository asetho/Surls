import { assetFromFilesystem } from "@/lib/custom-pages";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { path } = await params;
  const asset = await assetFromFilesystem(path);
  if (!asset) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(asset.body, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Length": String(asset.size),
      "Content-Type": asset.contentType,
      "Last-Modified": asset.updatedAt.toUTCString()
    }
  });
}
