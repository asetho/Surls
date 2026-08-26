import { NextResponse, type NextRequest } from "next/server";
import { AuditAction } from "@prisma/client";
import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { API_TOKEN_SCOPE_LINKS_CREATE, authenticateApiToken } from "@/lib/api-tokens";
import { requireAdmin } from "@/lib/auth";
import { validateCsrfValue } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { readJsonBodyWithLimit } from "@/lib/request";
import { createShortLink, shortUrl } from "@/lib/links";
import { appBaseUrl } from "@/lib/env";

export const LINK_CREATE_MAX_REQUEST_BYTES = 64 * 1024;
const createSchema = z.object({
  destinationUrl: z.string().url().max(4_096),
  code: z.string().optional(),
  title: z.string().max(240).optional(),
  description: z.string().max(4_000).optional(),
  notes: z.string().max(8_000).optional(),
  expiresAt: z.string().datetime().optional(),
  maxClicks: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional()
}).strict();

function requestOriginIsAllowed(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(appBaseUrl()).origin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const apiToken = await authenticateApiToken(authorization, API_TOKEN_SCOPE_LINKS_CREATE);
  if (authorization && !apiToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = apiToken?.user ?? (await requireAdmin());
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!apiToken) {
    try {
      validateCsrfValue(request.headers.get("X-Surls-CSRF") ?? "");
    } catch {
      return NextResponse.json({ error: "The form expired. Please refresh and try again." }, { status: 403 });
    }
    if (!requestOriginIsAllowed(request)) {
      return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
    }
  }

  const rate = await checkRateLimit(`api:create:${admin.id}`, 60, 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const body = await readJsonBodyWithLimit(request, LINK_CREATE_MAX_REQUEST_BYTES);
  if (!body.ok && body.error === "content_type") {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }
  if (!body.ok && body.error === "too_large") {
    return NextResponse.json({ error: "Payload is too large." }, { status: 413 });
  }
  const parsed = createSchema.safeParse(body.ok ? body.value : null);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  try {
    const link = await createShortLink({
      ...parsed.data,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      createdById: admin.id,
      createdByApiTokenName: apiToken?.name,
      createdByApiTokenPrefix: apiToken?.tokenPrefix
    });
    await auditLog({
      userId: admin.id,
      action: AuditAction.SHORT_LINK_CREATED,
      entityType: "ShortLink",
      entityId: link.id,
      details: { code: link.code, via: apiToken ? "api" : "session" }
    });
    return NextResponse.json(
      { id: link.id, code: link.code, shortUrl: shortUrl(appBaseUrl(), link.code), title: link.title },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create link" }, { status: 400 });
  }
}
