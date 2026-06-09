"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditLog } from "@/lib/audit";
import { isAdminUser, requireAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { archiveShortLink, deleteArchivedShortLink, restoreShortLink } from "@/lib/link-lifecycle";
import { createShortLink } from "@/lib/links";
import { prisma } from "@/lib/prisma";
import { parseSafeHttpUrl } from "@/lib/url-safety";

function optionalDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? new Date(text) : null;
}

function optionalInt(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? Number.parseInt(text, 10) : null;
}

function tagList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function createLinkAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) redirect("/login?next=/admin/links");

  const link = await createShortLink({
    destinationUrl: String(formData.get("destinationUrl") ?? ""),
    code: String(formData.get("code") ?? "") || null,
    title: String(formData.get("title") ?? "") || null,
    description: String(formData.get("description") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
    expiresAt: optionalDate(formData.get("expiresAt")),
    maxClicks: optionalInt(formData.get("maxClicks")),
    tags: tagList(formData.get("tags")),
    createdById: admin.id
  });

  await auditLog({
    userId: admin.id,
    action: AuditAction.SHORT_LINK_CREATED,
    entityType: "ShortLink",
    entityId: link.id,
    details: { code: link.code }
  });
  revalidatePath("/admin");
  revalidatePath("/admin/links");
  redirect(`/admin/links/${link.id}`);
}

export async function updateLinkAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const safe = parseSafeHttpUrl(String(formData.get("destinationUrl") ?? ""));
  if (!safe.ok) throw new Error(safe.error);

  const link = await prisma.shortLink.update({
    where: { id },
    data: {
      destinationUrl: safe.url,
      title: String(formData.get("title") ?? "") || null,
      description: String(formData.get("description") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
      enabled: formData.get("enabled") === "on",
      expiresAt: optionalDate(formData.get("expiresAt")),
      maxClicks: optionalInt(formData.get("maxClicks"))
    }
  });

  await auditLog({
    userId: admin.id,
    action: AuditAction.SHORT_LINK_UPDATED,
    entityType: "ShortLink",
    entityId: link.id,
    details: { code: link.code }
  });
  revalidatePath("/admin");
  revalidatePath("/admin/links");
  revalidatePath(`/admin/links/${id}`);
}

export async function archiveLinkAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const link = await archiveShortLink(id);
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
  if (!admin) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const link = await restoreShortLink(id);
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
  const admin = await requireAdmin();
  if (!admin) redirect("/login");
  if (!isAdminUser(admin)) throw new Error("Only admins can permanently delete links.");
  const id = String(formData.get("id") ?? "");
  const link = await deleteArchivedShortLink(id, formData.get("confirmCode"));
  await auditLog({
    userId: admin.id,
    action: AuditAction.SHORT_LINK_DELETED,
    entityType: "ShortLink",
    entityId: id,
    details: { code: link.code }
  });
  revalidatePath("/admin");
  revalidatePath("/admin/links");
  redirect("/admin/links?view=archived");
}
