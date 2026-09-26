import { NextResponse, type NextRequest } from "next/server";
import { API_TOKEN_SCOPE_UPLOADS_CREATE, authenticateApiToken } from "@/lib/api-tokens";
import { requireAdmin } from "@/lib/auth";
import { validateCsrfValue } from "@/lib/csrf";
import { appBaseUrl } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { getEffectiveUploadMaxBytes } from "@/lib/upload-limits";
import { acquireUploadRequest, checkUploadRateLimit } from "@/lib/upload-request-limits";
import { normalizeUploadFilenameMode, uploadMaxBytesLabel } from "@/lib/uploads";
import { checkUploadShortCodeAvailability, uploadAndShortenFile } from "@/lib/upload-and-shorten";

export const UPLOAD_MULTIPART_OVERHEAD_BYTES = 64 * 1024;
export const UPLOAD_MAX_BYTES_HEADER = "X-Surls-Upload-Max-Bytes";
export { UPLOAD_MAX_CONCURRENT_REQUESTS } from "@/lib/upload-request-limits";

function uploadLimitHeaders(maxBytes: number | null) {
  return { [UPLOAD_MAX_BYTES_HEADER]: maxBytes === null ? "unlimited" : String(maxBytes) };
}

async function readUploadFormData(request: NextRequest, uploadMaxBytes: number | null) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return { formData: null, invalidContentType: true, tooLarge: false };
  }
  const maxRequestBytes = uploadMaxBytes === null ? null : uploadMaxBytes + UPLOAD_MULTIPART_OVERHEAD_BYTES;
  const contentLength = Number(request.headers.get("content-length"));
  if (maxRequestBytes !== null && Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
    return { formData: null, invalidContentType: false, tooLarge: true };
  }

  if (!request.body) return { formData: null, invalidContentType: false, tooLarge: false };

  let bytesRead = 0;
  let tooLarge = false;
  const body = maxRequestBytes === null
    ? request.body
    : request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          bytesRead += chunk.byteLength;
          if (bytesRead > maxRequestBytes) {
            tooLarge = true;
            throw new Error("Upload request is too large.");
          }
          controller.enqueue(chunk);
        }
      }));

  try {
    const formData = await new Response(body, {
      headers: { "content-type": contentType }
    }).formData();
    return { formData, invalidContentType: false, tooLarge: false };
  } catch {
    return { formData: null, invalidContentType: false, tooLarge };
  }
}

function uploadedFormFile(value: FormDataEntryValue | null) {
  return typeof File !== "undefined" && value instanceof File ? value : null;
}

async function authenticateUploadRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const hasAuthorization = request.headers.has("authorization");
  const apiToken = await authenticateApiToken(
    authorization,
    API_TOKEN_SCOPE_UPLOADS_CREATE
  );
  if (hasAuthorization) return apiToken ? { apiToken, user: apiToken.user } : null;
  const user = await requireAdmin();
  return user ? { apiToken: null, user } : null;
}

export async function HEAD(request: NextRequest) {
  const auth = await authenticateUploadRequest(request);
  if (!auth) return new NextResponse(null, { status: 401 });
  const uploadMaxBytes = await getEffectiveUploadMaxBytes(auth.user);
  return new NextResponse(null, { headers: uploadLimitHeaders(uploadMaxBytes), status: 204 });
}

export async function GET(request: NextRequest) {
  const auth = await authenticateUploadRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rate = await checkRateLimit(`api:upload-code:${auth.user.id}`, 120, 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const code = request.nextUrl.searchParams.get("code")?.trim() ?? "";
  if (!code) return NextResponse.json({ error: "Enter a short keyword." }, { status: 400 });

  try {
    const uploadMaxBytes = await getEffectiveUploadMaxBytes(auth.user);
    return NextResponse.json(
      await checkUploadShortCodeAvailability(code),
      { headers: uploadLimitHeaders(uploadMaxBytes) }
    );
  } catch {
    return NextResponse.json({ error: "Could not check that short keyword." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateUploadRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.apiToken) {
    try {
      validateCsrfValue(request.headers.get("X-Surls-CSRF") ?? "");
    } catch {
      return NextResponse.json({ error: "The form expired. Please refresh and try again." }, { status: 403 });
    }
    if (request.headers.get("origin") !== new URL(appBaseUrl()).origin) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }
  }

  const rate = await checkUploadRateLimit(auth.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const uploadMaxBytes = await getEffectiveUploadMaxBytes(auth.user);
  const releaseUploadRequest = acquireUploadRequest();
  if (!releaseUploadRequest) {
    return NextResponse.json(
      { error: "Too many uploads are already in progress." },
      { headers: { "Retry-After": "5" }, status: 503 }
    );
  }

  try {
    const parsed = await readUploadFormData(request, uploadMaxBytes);
    if (parsed.invalidContentType) {
      return NextResponse.json({ error: "Content-Type must be multipart/form-data" }, { status: 415 });
    }
    if (parsed.tooLarge) {
      return NextResponse.json(
        { error: `Upload files up to ${uploadMaxBytesLabel(uploadMaxBytes)} at a time.` },
        { headers: uploadLimitHeaders(uploadMaxBytes), status: 413 }
      );
    }
    const formData = parsed.formData;
    if (!formData) return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
    const file = uploadedFormFile(formData.get("file"));
    if (!file) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    const title = String(formData.get("title") ?? "").trim() || file.name;
    if (title.length > 240) return NextResponse.json({ error: "Title must be 240 characters or fewer." }, { status: 400 });

    const result = await uploadAndShortenFile({
      code: String(formData.get("code") ?? "").trim() || null,
      createdByApiTokenName: auth.apiToken?.name,
      createdByApiTokenPrefix: auth.apiToken?.tokenPrefix,
      createdById: auth.user.id,
      dropExtension: formData.get("dropExtension") === "true" || formData.get("dropExtension") === "on",
      file,
      filenameMode: normalizeUploadFilenameMode(formData.get("filenameMode")),
      title,
      uploadMaxBytes,
      via: "api-upload"
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not upload and shorten the file." },
      { status: 400 }
    );
  } finally {
    releaseUploadRequest();
  }
}
