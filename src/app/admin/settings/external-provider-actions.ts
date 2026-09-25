"use server";

import { AuditAction, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminToastPath } from "@/lib/admin-toast";
import { auditLog } from "@/lib/audit";
import { requireSiteAdmin } from "@/lib/auth";
import { validateCsrf } from "@/lib/csrf";
import {
  disableExternalProviderSetting, externalProviderKey, ExternalProviderSettingsError,
  externalProviderType, getConfiguredExternalProviders, isExternalProvider, removeExternalProviderSetting, saveExternalProviderSetting
} from "@/lib/external-provider-settings";
import { getSetting, setSetting } from "@/lib/settings";
import { withSignInConfiguration } from "@/lib/sign-in-configuration";

function settingsToast(type: "error" | "success", message: string): never {
  redirect(adminToastPath("/admin/settings?externalSignIn=open", type, message));
}

async function authenticatedProviderChange(formData: FormData) {
  try {
    validateCsrf(formData);
  } catch {
    settingsToast("error", "The form expired. Please try again.");
  }
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminToastPath("/admin", "error", "Sign in again to continue."));
  const provider = formData.get("provider");
  if (!isExternalProvider(provider)) settingsToast("error", "Choose a valid sign-in provider.");
  const key = formData.get("key") ?? provider;
  if (externalProviderType(key) !== provider) settingsToast("error", "Choose a valid provider profile.");
  return { admin, provider, key: key as string };
}

async function ensureProviderCanChange(adminId: string, key: string, transaction: Prisma.TransactionClient) {
  if (await getSetting("localLoginEnabled", transaction)) return;
  const configs = await getConfiguredExternalProviders(transaction);
  if (!configs.some((config) => config.key === key)) return;
  const identities = await transaction.externalIdentity.findMany({ where: { userId: adminId }, select: { provider: true } });
  const connected = new Set(identities.map((identity) => identity.provider));
  const available = configs.filter((config) => connected.has(externalProviderKey(config)));
  if (configs.length === 1 || (available.length === 1 && available[0].key === key)) {
    throw new ExternalProviderSettingsError("Enable password sign-in or connect another provider before changing your only sign-in provider.");
  }
}

function revalidateSignInPages() {
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/profile");
  revalidatePath("/bookmarklet");
}

export async function setExternalLoginEnabledAction(formData: FormData) {
  try {
    validateCsrf(formData);
  } catch {
    settingsToast("error", "The form expired. Please try again.");
  }
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminToastPath("/admin", "error", "Sign in again to continue."));
  const requested = formData.get("enabled");
  if (requested !== "true" && requested !== "false") settingsToast("error", "Choose a valid external sign-in state.");
  const enabled = requested === "true";
  await withSignInConfiguration(async (transaction) => {
    if (!enabled && !(await getSetting("localLoginEnabled", transaction))) {
      settingsToast("error", "Enable password and passkey sign-in before disabling external sign-in.");
    }
    await setSetting("externalLoginEnabled", enabled, transaction);
  });
  await auditLog({ userId: admin.id, action: AuditAction.SETTINGS_CHANGED,
    entityType: "AppSetting", entityId: "externalLoginEnabled", details: { externalLoginEnabled: enabled } });
  revalidateSignInPages();
  settingsToast("success", enabled ? "External sign-in enabled." : "External sign-in disabled.");
}

export async function saveExternalProviderAction(formData: FormData) {
  const { admin, provider, key } = await authenticatedProviderChange(formData);
  try {
    await withSignInConfiguration(async (transaction) => {
      await ensureProviderCanChange(admin.id, key, transaction);
      await saveExternalProviderSetting(provider, {
        key,
        clientId: formData.get("clientId"),
        clientSecret: formData.get("clientSecret"),
        label: formData.get("label"),
        issuer: formData.get("issuer"),
        tenantId: formData.get("tenantId"),
        logoFile: formData.get("logoFile"),
        logoBase64: formData.get("logoBase64"),
        removeLogo: formData.get("removeLogo")
      }, transaction);
    });
  } catch (error) {
    settingsToast("error", error instanceof ExternalProviderSettingsError ? error.message : "Could not save this provider. Try again.");
  }
  await auditLog({ userId: admin.id, action: AuditAction.SETTINGS_CHANGED,
    entityType: "ExternalProviderSetting", entityId: key, details: { provider, enabled: true } });
  revalidateSignInPages();
  settingsToast("success", `${provider === "oidc" ? "OpenID Connect" : provider} sign-in saved and enabled.`);
}

export async function disableExternalProviderAction(formData: FormData) {
  const { admin, provider, key } = await authenticatedProviderChange(formData);
  try {
    await withSignInConfiguration(async (transaction) => {
      await ensureProviderCanChange(admin.id, key, transaction);
      await disableExternalProviderSetting(key, transaction);
    });
  } catch (error) {
    settingsToast("error", error instanceof ExternalProviderSettingsError ? error.message : "Could not disable this provider. Try again.");
  }
  await auditLog({ userId: admin.id, action: AuditAction.SETTINGS_CHANGED,
    entityType: "ExternalProviderSetting", entityId: key, details: { provider, enabled: false } });
  revalidateSignInPages();
  settingsToast("success", "Sign-in provider disabled.");
}

export async function removeExternalProviderAction(formData: FormData) {
  const { admin, provider, key } = await authenticatedProviderChange(formData);
  try {
    await withSignInConfiguration(async (transaction) => {
      await ensureProviderCanChange(admin.id, key, transaction);
      await removeExternalProviderSetting(key, transaction);
    });
  } catch (error) {
    settingsToast("error", error instanceof ExternalProviderSettingsError ? error.message : "Could not remove this provider. Try again.");
  }
  await auditLog({ userId: admin.id, action: AuditAction.SETTINGS_CHANGED,
    entityType: "ExternalProviderSetting", entityId: key, details: { provider, removed: true } });
  revalidateSignInPages();
  settingsToast("success", "Sign-in provider removed.");
}
