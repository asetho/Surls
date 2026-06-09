"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { createShortLink } from "@/lib/links";

function tagList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function safeInternalPath(value: string, fallback: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export async function createBookmarkletLinkAction(formData: FormData) {
  validateCsrf(formData);
  const returnTo = safeInternalPath(String(formData.get("returnTo") ?? "/bookmarklet"), "/bookmarklet");
  const admin = await requireAdmin();
  if (!admin) redirect(returnTo);

  const link = await createShortLink({
    destinationUrl: String(formData.get("destinationUrl") ?? ""),
    code: String(formData.get("code") ?? "") || null,
    title: String(formData.get("title") ?? "") || null,
    tags: tagList(formData.get("tags")),
    createdById: admin.id
  });

  await auditLog({
    userId: admin.id,
    action: AuditAction.SHORT_LINK_CREATED,
    entityType: "ShortLink",
    entityId: link.id,
    details: { code: link.code, source: "bookmarklet" }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/links");
  redirect(`/bookmarklet?created=${encodeURIComponent(link.id)}`);
}
