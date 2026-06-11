import { NextResponse, type NextRequest } from "next/server";
import { AuditAction } from "@prisma/client";
import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { authenticateApiToken } from "@/lib/api-tokens";
import { requireAdmin } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createShortLink, shortUrl } from "@/lib/links";
import { appBaseUrl } from "@/lib/env";

const createSchema = z.object({
  destinationUrl: z.string().url(),
  code: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  maxClicks: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional()
});

export async function POST(request: NextRequest) {
  const apiToken = await authenticateApiToken(request.headers.get("authorization"));
  const admin = apiToken?.user ?? (await requireAdmin());
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rate = await checkRateLimit(`api:create:${admin.id}`, 60, 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  try {
    const link = await createShortLink({
      ...parsed.data,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      createdById: admin.id
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
