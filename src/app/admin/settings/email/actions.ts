"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminToastPath } from "@/lib/admin-toast";
import { auditLog } from "@/lib/audit";
import { requireSiteAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import { sendSmtpTestEmail, verifySmtpConnection } from "@/lib/profile-email";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSetting, setSetting } from "@/lib/settings";
import {
  restoreEnvironmentSmtpSettings,
  saveSmtpSettings,
  getSmtpTransportConfig,
  getSmtpConnectionTestConfig,
  SmtpSettingsError
} from "@/lib/smtp-settings";

const EMAIL_SETTINGS_PATH = "/admin/settings/email";

function emailSettingsToast(type: "error" | "success", message: string): never {
  redirect(adminToastPath(EMAIL_SETTINGS_PATH, type, message));
}

async function authorizedAdmin(formData: FormData) {
  try {
    validateCsrf(formData);
  } catch {
    emailSettingsToast("error", "The form expired. Please try again.");
  }
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminToastPath("/admin", "error", "Sign in again to continue."));
  return admin;
}

function revalidateEmailSettings() {
  revalidatePath(EMAIL_SETTINGS_PATH);
  revalidatePath("/admin");
  revalidatePath("/admin/profile");
}

export async function savePasswordResetSettingAction(formData: FormData) {
  const admin = await authorizedAdmin(formData);
  const enabled = formData.get("emailPasswordResetsEnabled") === "on";
  if (enabled && !(await getSmtpTransportConfig())) {
    emailSettingsToast("error", "Configure SMTP delivery before enabling password resets.");
  }
  if (enabled && !(await getSetting("localLoginEnabled"))) {
    emailSettingsToast("error", "Enable password sign-in before enabling email password resets.");
  }
  const previous = await getSetting("emailPasswordResetsEnabled");
  if (previous !== enabled) {
    await setSetting("emailPasswordResetsEnabled", enabled);
    await auditLog({ userId: admin.id, action: AuditAction.SETTINGS_CHANGED,
      entityType: "AppSetting", entityId: "emailPasswordResetsEnabled", details: { enabled } });
  }
  revalidateEmailSettings();
  emailSettingsToast("success", enabled ? "Email password resets enabled." : "Email password resets disabled.");
}

export async function saveSmtpSettingsAction(formData: FormData) {
  const admin = await authorizedAdmin(formData);
  let result: Awaited<ReturnType<typeof saveSmtpSettings>>;
  try {
    result = await saveSmtpSettings(formData);
  } catch (error) {
    emailSettingsToast("error", error instanceof SmtpSettingsError ? error.message : "Could not save email settings.");
  }
  await auditLog({ userId: admin.id, action: AuditAction.SETTINGS_CHANGED,
    entityType: "AppSetting", entityId: "smtp", details: result });
  revalidateEmailSettings();
  emailSettingsToast("success", result.enabled ? "Email settings saved." : "Email delivery disabled.");
}

export async function restoreEnvironmentSmtpAction(formData: FormData) {
  const admin = await authorizedAdmin(formData);
  await restoreEnvironmentSmtpSettings();
  await auditLog({ userId: admin.id, action: AuditAction.SETTINGS_CHANGED,
    entityType: "AppSetting", entityId: "smtp", details: { restoredEnvironment: true } });
  revalidateEmailSettings();
  emailSettingsToast("success", "Environment email settings restored.");
}

export async function sendSmtpTestAction(formData: FormData) {
  const admin = await authorizedAdmin(formData);
  const recipientValue = formData.get("recipient");
  const recipient = typeof recipientValue === "string" ? recipientValue.trim() : "";
  if (recipient.length > 320 || /[\r\n\0]/.test(recipient) || !z.email().safeParse(recipient).success) {
    emailSettingsToast("error", "Enter a valid test recipient email address.");
  }
  const rate = await checkRateLimit(`smtp:test:${admin.id}`, 10, 15 * 60 * 1000);
  if (!rate.allowed) emailSettingsToast("error", "Too many test emails. Please wait and try again.");
  try {
    await sendSmtpTestEmail(recipient);
  } catch (error) {
    const smtpError = error && typeof error === "object" ? error as { command?: unknown; responseCode?: unknown } : null;
    if (smtpError?.command === "RCPT TO" && smtpError.responseCode === 550) {
      emailSettingsToast("error", "The SMTP server rejected that recipient (550). Use a mailbox or alias that can receive mail.");
    }
    emailSettingsToast("error", "Could not send the test email. Check the SMTP settings and server logs.");
  }
  emailSettingsToast("success", "Test email accepted by the SMTP server. Check the recipient inbox.");
}

export async function checkSmtpConnectionAction(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const admin = await authorizedAdmin(formData);
  let config: Awaited<ReturnType<typeof getSmtpConnectionTestConfig>>;
  try {
    config = await getSmtpConnectionTestConfig(formData);
  } catch (error) {
    return { ok: false, message: error instanceof SmtpSettingsError ? error.message : "Could not check the SMTP settings." };
  }
  const rate = await checkRateLimit(`smtp:connection:${admin.id}`, 3, 15 * 60 * 1000);
  if (!rate.allowed) return { ok: false, message: "Too many connection checks. Please wait and try again." };
  try {
    await verifySmtpConnection(config);
  } catch {
    return { ok: false, message: "Could not connect or sign in. Check the host, port, username, and password." };
  }
  return { ok: true, message: config.username
    ? "Secure SMTP connection and login succeeded. No email was sent or settings saved."
    : "Secure SMTP connection succeeded without login. No email was sent or settings saved." };
}
