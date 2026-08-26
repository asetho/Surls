"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit";
import { createApiToken } from "@/lib/api-tokens";
import { requireAdmin } from "@/lib/auth";
import { parseCsvRows } from "@/lib/csv";
import { validateCsrf } from "@/lib/csrf";
import { fetchWithPinnedAddress } from "@/lib/page-title";
import { prisma } from "@/lib/prisma";
import { getSiteName } from "@/lib/settings";
import { assertNoPrivateResolution, parseSafeHttpUrl, resolveSafeHttpAddress } from "@/lib/url-safety";
import { createShortLink } from "@/lib/links";
import { validateAlias } from "@/lib/alias";
import { env } from "@/lib/env";
import { normalizeUploadFilenameMode } from "@/lib/uploads";
import { uploadAndShortenFile } from "@/lib/upload-and-shorten";
import { getEffectiveUploadMaxBytes } from "@/lib/upload-limits";

const MAX_IMPORT_ROWS = 200;
const API_TOKEN_EXPIRATION_CHOICES = new Set([30, 90, 180, 365]);

export type UploadShortenState = {
  code?: string;
  error?: string;
  fileUrl?: string;
  filename?: string;
  shortUrl?: string;
};

function tokenExpiresAt(value: FormDataEntryValue | null) {
  if (value === "forever") return null;
  const days = Number.parseInt(String(value ?? ""), 10);
  const safeDays = API_TOKEN_EXPIRATION_CHOICES.has(days) ? days : env.API_TOKEN_DAYS;
  return new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);
}

async function trustedSafeResolution() {
  return true;
}

function uploadedFormFile(value: FormDataEntryValue | null) {
  return typeof File !== "undefined" && value instanceof File ? value : null;
}

export async function createTokenAction(_state: { token?: string; error?: string } | null, formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) return { error: "Unauthorized" };
  const fallbackName = `${await getSiteName()} API token`;
  const name = String(formData.get("name") ?? "").trim() || fallbackName;
  const expiresAt = tokenExpiresAt(formData.get("expiresInDays"));
  const { row, token } = await createApiToken(admin.id, name, { expiresAt });
  await auditLog({
    userId: admin.id,
    action: AuditAction.API_TOKEN_CREATED,
    entityType: "ApiToken",
    entityId: row.id,
    details: { expiresAt: row.expiresAt?.toISOString(), name, scopes: row.scopes, tokenPrefix: row.tokenPrefix }
  });
  revalidatePath("/admin/tools");
  return { token };
}

export async function revokeTokenAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const id = String(formData.get("id") ?? "");
  const result = await prisma.apiToken.updateMany({
    where: { id, userId: admin.id },
    data: { revokedAt: new Date() }
  });
  if (result.count > 0) {
    await auditLog({ userId: admin.id, action: AuditAction.API_TOKEN_REVOKED, entityType: "ApiToken", entityId: id });
  }
  revalidatePath("/admin/tools");
}

const TOKEN_ROLL_CONFLICT = "This API token changed before it could be rolled. Refresh and try again.";

export type RollTokenState = { token?: string; tokenName?: string; error?: string };

export async function rollTokenAction(_state: RollTokenState | null, formData: FormData): Promise<RollTokenState> {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) return { error: "Unauthorized" };
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Choose an API token to roll." };
  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.apiToken.findFirst({
        where: { id, userId: admin.id },
        select: { createdAt: true, expiresAt: true, id: true, name: true, revokedAt: true, scopes: true }
      });
      if (!current) return null;
      if (current.revokedAt) throw new Error(TOKEN_ROLL_CONFLICT);

      const lifetimeMs = current.expiresAt ? current.expiresAt.getTime() - current.createdAt.getTime() : null;
      const expiresAt = lifetimeMs === null
        ? null
        : lifetimeMs > 0
          ? new Date(now.getTime() + lifetimeMs)
          : undefined;
      const { row, token } = await createApiToken(
        admin.id,
        current.name,
        { expiresAt, scopes: current.scopes.split(",") },
        tx
      );
      const revoked = await tx.apiToken.updateMany({
        where: { id: current.id, userId: admin.id, revokedAt: null },
        data: { revokedAt: now }
      });
      if (revoked.count !== 1) throw new Error(TOKEN_ROLL_CONFLICT);

      await tx.auditLog.create({
        data: {
          userId: admin.id,
          action: AuditAction.API_TOKEN_REVOKED,
          entityType: "ApiToken",
          entityId: current.id,
          details: { replacementTokenId: row.id, rolled: true }
        }
      });
      await tx.auditLog.create({
        data: {
          userId: admin.id,
          action: AuditAction.API_TOKEN_CREATED,
          entityType: "ApiToken",
          entityId: row.id,
          details: {
            expiresAt: row.expiresAt?.toISOString(),
            name: current.name,
            replacesTokenId: current.id,
            rolled: true,
            scopes: row.scopes,
            tokenPrefix: row.tokenPrefix
          }
        }
      });

      return { token, tokenName: current.name };
    });

    return result ?? { error: "API token not found." };
  } catch (error) {
    if (error instanceof Error && error.message === TOKEN_ROLL_CONFLICT) return { error: error.message };
    throw error;
  }
}

export async function deleteTokenAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Choose an API token to delete.");
  const result = await prisma.apiToken.deleteMany({ where: { id, userId: admin.id } });
  if (result.count > 0) {
    await auditLog({
      userId: admin.id,
      action: AuditAction.API_TOKEN_REVOKED,
      entityType: "ApiToken",
      entityId: id,
      details: { deleted: true }
    });
  }
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const resolvedAddress = await resolveSafeHttpAddress(safe.url);
    const response = await fetchWithPinnedAddress(safe.url, {
      method: "HEAD",
      redirect: "manual",
      resolvedAddress,
      signal: controller.signal
    });
    await response.body?.cancel().catch(() => null);
    return { ok: true, message: `Reachable: HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Destination check failed." };
  } finally {
    clearTimeout(timeout);
  }
}

export async function importCsvAction(_state: { imported?: number; errors?: string[] } | null, formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) return { errors: ["Unauthorized"] };
  const text = String(formData.get("csv") ?? "");
  const confirm = formData.get("confirm") === "on";
  let rows: string[][];
  try {
    rows = parseCsvRows(text);
  } catch (error) {
    return { imported: 0, errors: [error instanceof Error ? error.message : "Could not parse CSV."] };
  }

  const errors: string[] = [];
  if (rows.length > MAX_IMPORT_ROWS) {
    errors.push(`Import at most ${MAX_IMPORT_ROWS} rows at a time.`);
  }

  const valid = rows
    .map(([destinationUrl, code, title], index) => {
      if (rows[index].length > 3) {
        errors.push(`Row ${index + 1}: Expected destination URL, optional alias, and optional title.`);
        return null;
      }
      const safe = parseSafeHttpUrl(destinationUrl ?? "");
      if (!safe.ok) {
        errors.push(`Row ${index + 1}: ${safe.error}`);
        return null;
      }
      const cleanCode = code?.trim() || undefined;
      if (cleanCode) {
        const aliasError = validateAlias(cleanCode);
        if (aliasError) {
          errors.push(`Row ${index + 1}: ${aliasError}`);
          return null;
        }
      }
      return { destinationUrl: safe.url, code: cleanCode, rowNumber: index + 1, title: title?.trim() || undefined };
    })
    .filter(Boolean) as Array<{ destinationUrl: string; code?: string; rowNumber: number; title?: string }>;

  const aliases = valid.flatMap((row) => (row.code ? [row.code] : []));
  const duplicateAliases = aliases.filter((alias, index) => aliases.indexOf(alias) !== index);
  for (const alias of Array.from(new Set(duplicateAliases))) {
    errors.push(`Alias "${alias}" appears more than once in this import.`);
  }
  if (aliases.length) {
    const existingAliases = await prisma.shortLink.findMany({
      where: { code: { in: aliases } },
      select: { code: true }
    });
    for (const link of existingAliases) {
      errors.push(`Alias "${link.code}" is already in use.`);
    }
  }

  if (errors.length === 0 && valid.length) {
    for (const row of valid) {
      try {
        await assertNoPrivateResolution(row.destinationUrl);
      } catch (error) {
        errors.push(`Row ${row.rowNumber}: ${error instanceof Error ? error.message : "Destination check failed."}`);
      }
    }
  }

  if (!confirm) {
    return {
      imported: 0,
      errors: errors.length
        ? errors
        : [`Preview OK: ${valid.length} row${valid.length === 1 ? "" : "s"} ready. Check Confirm import to create them.`]
    };
  }

  if (errors.length) return { imported: 0, errors };

  try {
    await prisma.$transaction(async (tx) => {
      for (const row of valid) {
        await createShortLink(
          {
            destinationUrl: row.destinationUrl,
            code: row.code || null,
            title: row.title || null,
            createdById: admin.id,
            fetchTitle: false
          },
          tx,
          { assertSafeResolution: trustedSafeResolution }
        );
      }
    });
  } catch (error) {
    return { imported: 0, errors: [error instanceof Error ? error.message : "Import failed. No links were created."] };
  }

  const imported = valid.length;
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

export async function uploadAndShortenAction(
  _state: UploadShortenState | null,
  formData: FormData
): Promise<UploadShortenState> {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) return { error: "Unauthorized" };

  const file = uploadedFormFile(formData.get("file"));
  if (!file) return { error: "Choose a file to upload." };

  try {
    const uploadMaxBytes = await getEffectiveUploadMaxBytes(admin);
    const result = await uploadAndShortenFile({
      code: String(formData.get("code") ?? "").trim() || null,
      createdById: admin.id,
      dropExtension: formData.get("dropExtension") === "on",
      file,
      filenameMode: normalizeUploadFilenameMode(formData.get("filenameMode")),
      title: String(formData.get("title") ?? "").trim() || file.name,
      uploadMaxBytes,
      via: "upload"
    });
    revalidatePath("/admin");
    revalidatePath("/admin/links");
    revalidatePath("/admin/tools");
    return result;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not upload and shorten the file." };
  }
}
