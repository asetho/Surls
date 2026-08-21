import { NextResponse, type NextRequest } from "next/server";
import { API_TOKEN_SCOPE_UPLOADS_CREATE, authenticateApiToken } from "@/lib/api-tokens";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeUploadFilenameMode, uploadMaxBytes } from "@/lib/uploads";
import { checkUploadShortCodeAvailability, uploadAndShortenFile } from "@/lib/upload-and-shorten";

export const UPLOAD_MULTIPART_OVERHEAD_BYTES = 64 * 1024;

async function readUploadFormData(request: NextRequest) {
  const maxBytes = uploadMaxBytes() + UPLOAD_MULTIPART_OVERHEAD_BYTES;
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { formData: null, tooLarge: true };
  }

  if (!request.body) return { formData: null, tooLarge: false };

  let bytesRead = 0;
  let tooLarge = false;
  const limitedBody = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytesRead += chunk.byteLength;
      if (bytesRead > maxBytes) {
        tooLarge = true;
        throw new Error("Upload request is too large.");
      }
      controller.enqueue(chunk);
    }
  }));

  try {
    const contentType = request.headers.get("content-type") ?? "";
    const formData = await new Response(limitedBody, {
      headers: { "content-type": contentType }
    }).formData();
    return { formData, tooLarge: false };
  } catch {
    return { formData: null, tooLarge };
  }
}

function uploadedFormFile(value: FormDataEntryValue | null) {
  return typeof File !== "undefined" && value instanceof File ? value : null;
}

export async function HEAD(request: NextRequest) {
  const apiToken = await authenticateApiToken(
    request.headers.get("authorization"),
    API_TOKEN_SCOPE_UPLOADS_CREATE
  );
  return new NextResponse(null, { status: apiToken ? 204 : 401 });
}

export async function GET(request: NextRequest) {
  const apiToken = await authenticateApiToken(
    request.headers.get("authorization"),
    API_TOKEN_SCOPE_UPLOADS_CREATE
  );
  if (!apiToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rate = await checkRateLimit(`api:upload-code:${apiToken.userId}`, 120, 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const code = request.nextUrl.searchParams.get("code")?.trim() ?? "";
  if (!code) return NextResponse.json({ error: "Enter a short keyword." }, { status: 400 });

  try {
    return NextResponse.json(await checkUploadShortCodeAvailability(code));
  } catch {
    return NextResponse.json({ error: "Could not check that short keyword." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const apiToken = await authenticateApiToken(
    request.headers.get("authorization"),
    API_TOKEN_SCOPE_UPLOADS_CREATE
  );
  if (!apiToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rate = await checkRateLimit(`api:upload:${apiToken.userId}`, 30, 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const parsed = await readUploadFormData(request);
  if (parsed.tooLarge) {
    return NextResponse.json({ error: "Upload request is too large." }, { status: 413 });
  }
  const formData = parsed.formData;
  if (!formData) return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  const file = uploadedFormFile(formData.get("file"));
  if (!file) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });

  try {
    const result = await uploadAndShortenFile({
      code: String(formData.get("code") ?? "").trim() || null,
      createdByApiTokenName: apiToken.name,
      createdByApiTokenPrefix: apiToken.tokenPrefix,
      createdById: apiToken.userId,
      dropExtension: formData.get("dropExtension") === "true" || formData.get("dropExtension") === "on",
      file,
      filenameMode: normalizeUploadFilenameMode(formData.get("filenameMode")),
      title: String(formData.get("title") ?? "").trim() || file.name,
      via: "api-upload"
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not upload and shorten the file." },
      { status: 400 }
    );
  }
}
