"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { generateBackupCodes, hashBackupCode } from "@/lib/backup-codes";
import { validateCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { getSiteName } from "@/lib/settings";
import { createTotpSecret, verifyTotpCode } from "@/lib/totp";

export async function startTotpAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const secret = createTotpSecret(admin.email, await getSiteName());
  await prisma.totpCredential.upsert({
    where: { userId: admin.id },
    update: { secretEncrypted: secret.encryptedSecret, enabled: false, enabledAt: null },
    create: { userId: admin.id, secretEncrypted: secret.encryptedSecret, enabled: false }
  });
  revalidatePath("/admin/profile");
}

export async function enableTotpAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const credential = await prisma.totpCredential.findUnique({ where: { userId: admin.id } });
  if (!credential || !(await verifyTotpCode(credential.secretEncrypted, String(formData.get("code") ?? "")))) {
    throw new Error("Invalid TOTP code.");
  }
  await prisma.totpCredential.update({
    where: { userId: admin.id },
    data: { enabled: true, enabledAt: new Date() }
  });
  await auditLog({ userId: admin.id, action: AuditAction.TOTP_ENABLED });
  revalidatePath("/admin/profile");
}

export async function disableTotpAction(formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  await prisma.totpCredential.deleteMany({ where: { userId: admin.id } });
  await auditLog({ userId: admin.id, action: AuditAction.TOTP_DISABLED });
  revalidatePath("/admin/profile");
}

export async function regenerateBackupCodesAction(_state: { codes: string[] } | null, formData: FormData) {
  validateCsrf(formData);
  const admin = await requireAdmin();
  if (!admin) throw new Error("Unauthorized");
  const codes = generateBackupCodes();
  const hashedCodes = await Promise.all(codes.map(async (code) => ({ code, codeHash: await hashBackupCode(code) })));
  await prisma.$transaction([
    prisma.backupCode.deleteMany({ where: { userId: admin.id } }),
    ...hashedCodes.map((code) =>
      prisma.backupCode.create({
        data: { userId: admin.id, codeHash: code.codeHash }
      })
    )
  ]);
  await auditLog({ userId: admin.id, action: AuditAction.BACKUP_CODES_REGENERATED });
  revalidatePath("/admin/profile");
  return { codes };
}
