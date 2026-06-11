import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { appBaseUrl } from "@/lib/env";
import { shortUrl } from "@/lib/links";
import { prisma } from "@/lib/prisma";
import {
  generateQrEps,
  generateQrPng,
  generateQrSvg,
  normalizeQrErrorCorrectionLevel,
  normalizeQrFormat,
  normalizeQrSize
} from "@/lib/qr";

type Params = {
  params: Promise<{ id: string; format: string }>;
};

const contentTypes = {
  png: "image/png",
  svg: "image/svg+xml; charset=utf-8",
  eps: "application/postscript; charset=utf-8"
} as const;

export async function GET(request: NextRequest, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, format: formatParam } = await params;
  const format = normalizeQrFormat(formatParam);
  if (!format) {
    return NextResponse.json({ error: "Unsupported QR format." }, { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const size = normalizeQrSize(searchParams.get("size"));
  const level = normalizeQrErrorCorrectionLevel(searchParams.get("level"));
  const link = await prisma.shortLink.findUnique({ where: { id }, select: { code: true } });
  if (!link) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  const url = shortUrl(appBaseUrl(), link.code);
  const body =
    format === "png"
      ? await generateQrPng(url, size, level)
      : format === "svg"
        ? await generateQrSvg(url, size, level)
        : generateQrEps(url, size, level);
  const filename = `${link.code}-qr-${size}-${level}.${format}`;
  const disposition = searchParams.get("download") === "1" ? "attachment" : "inline";
  const responseBody = typeof body === "string" ? body : new Uint8Array(body);

  return new Response(responseBody, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Content-Type": contentTypes[format]
    }
  });
}
