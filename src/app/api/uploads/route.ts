import { NextResponse, type NextRequest } from "next/server";
import { API_TOKEN_SCOPE_UPLOADS_CREATE, authenticateApiToken } from "@/lib/api-tokens";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeUploadFilenameMode } from "@/lib/uploads";
import { uploadAndShortenFile } from "@/lib/upload-and-shorten";

function uploadedFormFile(value: FormDataEntryValue | null) {
  return typeof File !== "undefined" && value instanceof File ? value : null;
}

export async function POST(request: NextRequest) {
  const apiToken = await authenticateApiToken(
    request.headers.get("authorization"),
    API_TOKEN_SCOPE_UPLOADS_CREATE
  );
  if (!apiToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rate = await checkRateLimit(`api:upload:${apiToken.userId}`, 30, 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const formData = await request.formData().catch(() => null);
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
