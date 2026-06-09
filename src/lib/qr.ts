import QRCode, { type QRCodeErrorCorrectionLevel } from "qrcode";

export const QR_SIZES = [150, 300, 500] as const;
export const QR_ERROR_CORRECTION_LEVELS = ["L", "M", "Q", "H"] as const;
export const QR_FORMATS = ["png", "svg", "eps"] as const;
export const QR_CONTENT_TYPES = {
  png: "image/png",
  svg: "image/svg+xml; charset=utf-8",
  eps: "application/postscript; charset=utf-8"
} as const;

export type QrSize = (typeof QR_SIZES)[number];
export type QrErrorCorrectionLevel = (typeof QR_ERROR_CORRECTION_LEVELS)[number];
export type QrFormat = (typeof QR_FORMATS)[number];

export function normalizeQrSize(value: string | null): QrSize {
  const size = Number.parseInt(value ?? "", 10);
  return QR_SIZES.includes(size as QrSize) ? (size as QrSize) : 300;
}

export function normalizeQrErrorCorrectionLevel(value: string | null): QrErrorCorrectionLevel {
  const level = String(value ?? "").toUpperCase();
  return QR_ERROR_CORRECTION_LEVELS.includes(level as QrErrorCorrectionLevel)
    ? (level as QrErrorCorrectionLevel)
    : "M";
}

export function normalizeQrFormat(value: string | null): QrFormat | null {
  const format = String(value ?? "").toLowerCase();
  return QR_FORMATS.includes(format as QrFormat) ? (format as QrFormat) : null;
}

export function qrAssetPath(input: {
  code: string;
  format: QrFormat;
  size: QrSize;
  level: QrErrorCorrectionLevel;
  download?: boolean;
}) {
  const params = new URLSearchParams({ size: String(input.size), level: input.level });
  if (input.download) params.set("download", "1");
  return `/${encodeURIComponent(input.code)}/qr/${input.format}?${params.toString()}`;
}

export function apiQrAssetPath(input: {
  linkId: string;
  format: QrFormat;
  size: QrSize;
  level: QrErrorCorrectionLevel;
  download?: boolean;
}) {
  const params = new URLSearchParams({ size: String(input.size), level: input.level });
  if (input.download) params.set("download", "1");
  return `/api/links/${input.linkId}/qr/${input.format}?${params.toString()}`;
}

export function qrAssetFilename(input: {
  code: string;
  format: QrFormat;
  size: QrSize;
  level: QrErrorCorrectionLevel;
}) {
  return `${input.code}-qr-${input.size}-${input.level}.${input.format}`;
}

function qrRenderOptions(size: QrSize, level: QrErrorCorrectionLevel) {
  return {
    errorCorrectionLevel: level as QRCodeErrorCorrectionLevel,
    margin: 1,
    width: size
  };
}

export async function generateQrPng(text: string, size: QrSize, level: QrErrorCorrectionLevel) {
  return QRCode.toBuffer(text, qrRenderOptions(size, level));
}

export async function generateQrSvg(text: string, size: QrSize, level: QrErrorCorrectionLevel) {
  return QRCode.toString(text, { ...qrRenderOptions(size, level), type: "svg" });
}

export async function generateQrAssetBody(
  format: QrFormat,
  text: string,
  size: QrSize,
  level: QrErrorCorrectionLevel
) {
  return format === "png"
    ? await generateQrPng(text, size, level)
    : format === "svg"
      ? await generateQrSvg(text, size, level)
      : generateQrEps(text, size, level);
}

export function generateQrEps(text: string, size: QrSize, level: QrErrorCorrectionLevel) {
  const margin = 1;
  const qr = QRCode.create(text, { errorCorrectionLevel: level as QRCodeErrorCorrectionLevel });
  const moduleCount = qr.modules.size;
  const cellSize = size / (moduleCount + margin * 2);
  const lines = [
    "%!PS-Adobe-3.0 EPSF-3.0",
    `%%BoundingBox: 0 0 ${size} ${size}`,
    "%%Creator: Surls",
    "%%LanguageLevel: 2",
    "%%EndComments",
    "1 1 1 setrgbcolor",
    `0 0 ${size} ${size} rectfill`,
    "0 0 0 setrgbcolor"
  ];

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!qr.modules.get(row, col)) continue;
      const x = (col + margin) * cellSize;
      const y = size - (row + margin + 1) * cellSize;
      lines.push(`${x.toFixed(3)} ${y.toFixed(3)} ${cellSize.toFixed(3)} ${cellSize.toFixed(3)} rectfill`);
    }
  }

  lines.push("showpage", "%%EOF");
  return `${lines.join("\n")}\n`;
}
