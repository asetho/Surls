"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit";
import { createApiToken } from "@/lib/api-tokens";
import { requireAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { getSiteName } from "@/lib/settings";
import { assertNoPrivateResolution, parseSafeHttpUrl } from "@/lib/url-safety";
import { createShortLink } from "@/lib/links";

export async function createTokenAction(_state: { token?: string; error?: string } | null, formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) return { error: "Unauthorized" };
  const fallbackName = `${await getSiteName()} API token`;
  const name = String(formData.get("name") ?? "").trim() || fallbackName;
  const { row, token } = await createApiToken(admin.id, name);
  await auditLog({
    userId: admin.id,
    action: AuditAction.API_TOKEN_CREATED,
    entityType: "ApiToken",
    entityId: row.id,
    details: { name, tokenPrefix: row.tokenPrefix }
  });
  revalidatePath("/admin/tools");
  return { token };
}

export async function revokeTokenAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const id = String(formData.get("id") ?? "");
  await prisma.apiToken.updateMany({
    where: { id, userId: admin.id },
    data: { revokedAt: new Date() }
  });
  await auditLog({ userId: admin.id, action: AuditAction.API_TOKEN_REVOKED, entityType: "ApiToken", entityId: id });
  revalidatePath("/admin/tools");
}

export async function checkDestinationAction(
  _state: { ok?: boolean; message?: string } | null,
  formData: FormData
) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "Unauthorized" };
  const safe = parseSafeHttpUrl(String(formData.get("url") ?? ""));
  if (!safe.ok) return { ok: false, message: safe.error };
  try {
    await assertNoPrivateResolution(safe.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(safe.url, { method: "HEAD", signal: controller.signal, redirect: "manual" });
    clearTimeout(timeout);
    return { ok: true, message: `Reachable: HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Destination check failed." };
  }
}

export async function importCsvAction(_state: { imported?: number; errors?: string[] } | null, formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) return { errors: ["Unauthorized"] };
  const text = String(formData.get("csv") ?? "");
  const confirm = formData.get("confirm") === "on";
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((value) => value.trim()));
  const errors: string[] = [];
  const valid = rows
    .map(([destinationUrl, code, title], index) => {
      const safe = parseSafeHttpUrl(destinationUrl ?? "");
      if (!safe.ok) {
        errors.push(`Row ${index + 1}: ${safe.error}`);
        return null;
      }
      return { destinationUrl: safe.url, code, title };
    })
    .filter(Boolean) as Array<{ destinationUrl: string; code?: string; title?: string }>;

  if (!confirm) {
    return {
      imported: 0,
      errors: errors.length
        ? errors
        : [`Preview OK: ${valid.length} row${valid.length === 1 ? "" : "s"} ready. Check Confirm import to create them.`]
    };
  }

  let imported = 0;
  for (const row of valid) {
    await createShortLink({
      destinationUrl: row.destinationUrl,
      code: row.code || null,
      title: row.title || null,
      createdById: admin.id
    });
    imported += 1;
  }
  await auditLog({
    userId: admin.id,
    action: AuditAction.SHORT_LINK_CREATED,
    entityType: "BulkImport",
    details: { imported }
  });
  revalidatePath("/admin");
  revalidatePath("/admin/links");
  return { imported, errors };
}
