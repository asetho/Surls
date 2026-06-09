import { NextResponse, type NextRequest } from "next/server";
import { appBaseUrl } from "@/lib/env";
import { shortUrl } from "@/lib/links";
import { prisma } from "@/lib/prisma";
import {
  generateQrAssetBody,
  normalizeQrErrorCorrectionLevel,
  normalizeQrFormat,
  normalizeQrSize,
  QR_CONTENT_TYPES,
  qrAssetFilename
} from "@/lib/qr";

type Params = {
  params: Promise<{ code: string; format: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const { code, format: formatParam } = await params;
  const format = normalizeQrFormat(formatParam);
  if (!format) {
    return NextResponse.json({ error: "Unsupported QR format." }, { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const size = normalizeQrSize(searchParams.get("size"));
  const level = normalizeQrErrorCorrectionLevel(searchParams.get("level"));
  const link = await prisma.shortLink.findUnique({ where: { code }, select: { code: true } });
  if (!link) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  const url = shortUrl(appBaseUrl(), link.code);
  const body = await generateQrAssetBody(format, url, size, level);
  const filename = qrAssetFilename({ code: link.code, format, size, level });
  const disposition = searchParams.get("download") === "1" ? "attachment" : "inline";
  const responseBody = typeof body === "string" ? body : new Uint8Array(body);

  return new Response(responseBody, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Content-Type": QR_CONTENT_TYPES[format]
    }
  });
}
