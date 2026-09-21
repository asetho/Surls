"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditLog } from "@/lib/audit";
import { isAdminUser, requireAdmin, requireSiteAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { archiveShortLink, deleteShortLink, restoreShortLink } from "@/lib/link-lifecycle";
import {
  normalizeOptionalDate,
  normalizeOptionalPositiveInt,
  normalizeShortLinkDestinationUrl,
  normalizeShortLinkTags,
  normalizeShortLinkTextFields
} from "@/lib/links";
import { prisma } from "@/lib/prisma";
import { safeRedirectPath } from "@/lib/redirect-path";
import { assertNoPrivateResolution, parseSafeHttpUrl } from "@/lib/url-safety";
import { createLinkFromFormData } from "./create-link";

function optionalDate(value: FormDataEntryValue | null) {
  return normalizeOptionalDate(value);
}

function optionalInt(value: FormDataEntryValue | null) {
  return normalizeOptionalPositiveInt(value, "Max clicks");
}

function tagList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function createLinkAction(formData: FormData) {
  const link = await createLinkFromFormData(formData);
  if (!link) redirect("/admin?next=/admin/links");
  redirect(`/admin/links/${link.id}`);
}

export async function updateLinkAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) redirect("/admin");
  const id = String(formData.get("id") ?? "");
  const safe = parseSafeHttpUrl(normalizeShortLinkDestinationUrl(formData.get("destinationUrl")));
  if (!safe.ok) throw new Error(safe.error);
  await assertNoPrivateResolution(safe.url);
  const tags = normalizeShortLinkTags(tagList(formData.get("tags")));
  const text = normalizeShortLinkTextFields({
    title: formData.get("title"),
    description: formData.get("description"),
    notes: formData.get("notes")
  });

  const link = await prisma.shortLink.update({
    // Keep the owner predicate in the database update so a guessed link ID cannot cross accounts.
    where: isAdminUser(admin) ? { id } : { id, createdById: admin.id },
    data: {
      destinationUrl: safe.url,
      title: text.title,
      description: text.description,
      notes: text.notes,
      enabled: formData.get("enabled") === "on",
      expiresAt: optionalDate(formData.get("expiresAt")),
      maxClicks: optionalInt(formData.get("maxClicks")),
      tags: {
        deleteMany: {},
        ...(tags.length
          ? {
              create: tags.map(({ name, slug }) => ({
                tag: {
                  connectOrCreate: {
                    where: { slug },
                    create: { name, slug }
                  }
                }
              }))
            }
          : {})
      }
    }
  });

  await auditLog({
    userId: admin.id,
    action: AuditAction.SHORT_LINK_UPDATED,
    entityType: "ShortLink",
    entityId: link.id,
    details: { code: link.code, tags: tags.map(({ name }) => name) }
  });
  revalidatePath("/admin");
  revalidatePath("/admin/links");
  revalidatePath(`/admin/links/${id}`);
}

export async function archiveLinkAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) redirect("/admin");
  const id = String(formData.get("id") ?? "");
  const link = await archiveShortLink(id, admin);
  await auditLog({
    userId: admin.id,
    action: AuditAction.SHORT_LINK_ARCHIVED,
    entityType: "ShortLink",
    entityId: id,
    details: { code: link.code }
  });
  revalidatePath("/admin");
  revalidatePath("/admin/links");
  revalidatePath(`/admin/links/${id}`);
  redirect("/admin/links?view=archived");
}

export async function restoreLinkAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) redirect("/admin");
  const id = String(formData.get("id") ?? "");
  const link = await restoreShortLink(id, admin);
  await auditLog({
    userId: admin.id,
    action: AuditAction.SHORT_LINK_UPDATED,
    entityType: "ShortLink",
    entityId: id,
    details: { code: link.code, restored: true }
  });
  revalidatePath("/admin");
  revalidatePath("/admin/links");
  revalidatePath(`/admin/links/${id}`);
  redirect(`/admin/links/${id}`);
}

export async function deleteLinkAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireSiteAdmin();
  if (!admin) throw new Error("Only admins can permanently delete links.");
  const id = String(formData.get("id") ?? "");
  const returnTo = safeRedirectPath(formData.get("returnTo"), "/admin/links");
  const link = await deleteShortLink(id, formData.get("confirmCode"));
  await auditLog({
    userId: admin.id,
    action: AuditAction.SHORT_LINK_DELETED,
    entityType: "ShortLink",
    entityId: id,
    details: { code: link.code }
  });
  revalidatePath("/admin");
  revalidatePath("/admin/links");
  revalidatePath(`/admin/links/${id}`);
  redirect(returnTo);
}
