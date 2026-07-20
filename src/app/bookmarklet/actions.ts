"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { createShortLink } from "@/lib/links";

const MAX_TAGS_FIELD_LENGTH = 8_000;

function tagList(value: FormDataEntryValue | null) {
  const raw = String(value ?? "");
  if (raw.length > MAX_TAGS_FIELD_LENGTH) throw new Error("Tags are too long.");
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function safeInternalPath(value: string, fallback: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function redirectWithCreateError(returnTo: string, message: string): never {
  const url = new URL(returnTo, "http://surls.local");
  url.searchParams.set("createError", message.slice(0, 240));
  redirect(`${url.pathname}${url.search}`);
}

export async function createBookmarkletLinkAction(formData: FormData) {
  const returnTo = safeInternalPath(String(formData.get("returnTo") ?? "/bookmarklet"), "/bookmarklet");

  try {
    validateCsrf(formData);
  } catch {
    redirectWithCreateError(returnTo, "The form expired. Please try again.");
  }

  const admin = await requireAdmin();
  if (!admin) redirect(returnTo);

  let link: Awaited<ReturnType<typeof createShortLink>>;
  try {
    link = await createShortLink({
      destinationUrl: String(formData.get("destinationUrl") ?? ""),
      code: String(formData.get("code") ?? "") || null,
      title: String(formData.get("title") ?? "") || null,
      tags: tagList(formData.get("tags")),
      createdById: admin.id
    });
  } catch (error) {
    redirectWithCreateError(returnTo, errorMessage(error, "Could not create that short URL."));
  }

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
