import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { createShortLink, normalizeOptionalDate, normalizeOptionalPositiveInt } from "@/lib/links";

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

export async function createLinkFromFormData(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) return null;

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
  return link;
}
