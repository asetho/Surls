"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { requireSiteAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import {
  emailTemplateId, restoreEmailTemplate, saveEmailTemplate, validateEmailTemplate,
  EmailTemplateError, type EmailTemplateContent
} from "@/lib/email-templates";
import { sendEmailTemplatePreview } from "@/lib/profile-email";
import { checkRateLimit } from "@/lib/rate-limit";

type ActionResult = { ok: boolean; message: string; content?: EmailTemplateContent };
const TEMPLATES_PATH = "/admin/settings/email/templates";

async function authorizedAdmin(formData: FormData) {
  try {
    validateCsrf(formData);
  } catch {
    return null;
  }
  return requireSiteAdmin();
}

function draftFromForm(formData: FormData) {
  return {
    subject: formData.get("subject"),
    text: formData.get("text"),
    html: formData.get("html")
  };
}

export async function saveEmailTemplateAction(formData: FormData): Promise<ActionResult> {
  const admin = await authorizedAdmin(formData);
  if (!admin) return { ok: false, message: "Sign in again or refresh this page before saving." };
  try {
    const id = emailTemplateId(formData.get("templateId"));
    await saveEmailTemplate(id, draftFromForm(formData));
    await auditLog({ userId: admin.id, action: AuditAction.SETTINGS_CHANGED,
      entityType: "AppSetting", entityId: `emailTemplate:${id}`, details: { customized: true } });
    revalidatePath(TEMPLATES_PATH);
    return { ok: true, message: "Email template saved." };
  } catch (error) {
    return { ok: false, message: error instanceof EmailTemplateError ? error.message : "Could not save the email template." };
  }
}

export async function restoreEmailTemplateAction(formData: FormData): Promise<ActionResult> {
  const admin = await authorizedAdmin(formData);
  if (!admin) return { ok: false, message: "Sign in again or refresh this page before restoring defaults." };
  try {
    const id = emailTemplateId(formData.get("templateId"));
    const content = await restoreEmailTemplate(id);
    await auditLog({ userId: admin.id, action: AuditAction.SETTINGS_CHANGED,
      entityType: "AppSetting", entityId: `emailTemplate:${id}`, details: { customized: false } });
    revalidatePath(TEMPLATES_PATH);
    return { ok: true, message: "Default template restored.", content };
  } catch {
    return { ok: false, message: "Could not restore the default template." };
  }
}

export async function sendEmailTemplatePreviewAction(formData: FormData): Promise<ActionResult> {
  const admin = await authorizedAdmin(formData);
  if (!admin) return { ok: false, message: "Sign in again or refresh this page before sending a preview." };
  const recipientValue = formData.get("recipient");
  const recipient = typeof recipientValue === "string" ? recipientValue.trim() : "";
  if (recipient.length > 320 || /[\r\n\0]/.test(recipient) || !z.email().safeParse(recipient).success) {
    return { ok: false, message: "Enter a valid preview recipient email address." };
  }
  try {
    const id = emailTemplateId(formData.get("templateId"));
    const content = validateEmailTemplate(id, draftFromForm(formData));
    const rate = await checkRateLimit(`smtp:test:${admin.id}`, 10, 15 * 60 * 1000);
    if (!rate.allowed) return { ok: false, message: "Too many test or preview emails. Please wait and try again." };
    await sendEmailTemplatePreview(recipient, id, content);
    return { ok: true, message: "Preview accepted by the SMTP server. Check the recipient inbox." };
  } catch (error) {
    if (error instanceof EmailTemplateError) return { ok: false, message: error.message };
    const smtpError = error && typeof error === "object" ? error as { command?: unknown; responseCode?: unknown } : null;
    if (smtpError?.command === "RCPT TO" && smtpError.responseCode === 550) {
      return { ok: false, message: "The SMTP server rejected that recipient (550). Use a mailbox or alias that can receive mail." };
    }
    return { ok: false, message: "Could not send the preview. Check the SMTP settings and server logs." };
  }
}
