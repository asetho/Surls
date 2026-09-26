"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditLog } from "@/lib/audit";
import { isAdminUser, requireAdmin, requireSiteAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import {
  DEFAULT_LINK_PAGE_SIZE,
  archiveShortLink,
  deleteShortLink,
  normalizeLinkListPageSize,
  normalizeLinkListSort,
  normalizeLinkListTag,
  normalizeLinkListView,
  restoreShortLink
} from "@/lib/link-lifecycle";
import {
  normalizeOptionalDate,
  normalizeOptionalPositiveInt,
  normalizeShortLinkDestinationUrl,
  normalizeShortLinkTags,
  normalizeShortLinkTextFields
} from "@/lib/links";
import { prisma } from "@/lib/prisma";
import { LINK_CREATE_RATE_LIMIT_MESSAGE } from "@/lib/link-create-limits";
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

function linkListPath(formData: FormData, pageSize: number) {
  const params = new URLSearchParams();
  const view = normalizeLinkListView(formData.get("view"));
  const query = String(formData.get("q") ?? "").trim();
  const sort = normalizeLinkListSort(formData.get("sort"));
  const tag = normalizeLinkListTag(formData.get("tag"));

  if (view === "archived") params.set("view", view);
  if (query) params.set("q", query);
  if (tag) params.set("tag", tag);
  if (sort !== "newest") params.set("sort", sort);
  if (pageSize !== DEFAULT_LINK_PAGE_SIZE) params.set("pageSize", String(pageSize));

  const search = params.toString();
  return search ? `/admin/links?${search}` : "/admin/links";
}

export async function filterLinksAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) redirect("/admin");

  const pageSize = normalizeLinkListPageSize(formData.get("pageSize"));
  if (pageSize !== admin.linkListPageSize) {
    await prisma.user.update({
      where: { id: admin.id },
      data: { linkListPageSize: pageSize }
    });
  }

  revalidatePath("/admin/links");
  redirect(linkListPath(formData, pageSize));
}

export async function createLinkAction(_state: { error?: string } | null, formData: FormData) {
  let link: Awaited<ReturnType<typeof createLinkFromFormData>>;
  try {
    link = await createLinkFromFormData(formData);
  } catch (error) {
    if (error instanceof Error && error.message === LINK_CREATE_RATE_LIMIT_MESSAGE) {
      return { error: LINK_CREATE_RATE_LIMIT_MESSAGE };
    }
    throw error;
  }
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
