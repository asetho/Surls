import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProfileFlowPreview } from "./ProfileFlowPreview";
import { adminLoginPath } from "@/lib/admin-login-path";
import { requireSiteAdmin } from "@/lib/auth";
import { hmservDevPreviewEnabled } from "@/lib/dev-preview";
import { externalProviderKey, getConfiguredExternalProviders } from "@/lib/external-provider-settings";
import { prisma } from "@/lib/prisma";
import { profileEmailAvailable } from "@/lib/profile-email";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile verification preview",
  robots: { index: false, follow: false }
};

export default async function ProfileFlowPreviewPage() {
  if (!hmservDevPreviewEnabled()) notFound();
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminLoginPath("/admin/dev/profile"));

  const [settings, providers, linkedIdentities, passkeyCount, emailCodeAvailable] = await Promise.all([
    getSettings(),
    getConfiguredExternalProviders(),
    prisma.externalIdentity.findMany({ where: { userId: admin.id }, select: { provider: true } }),
    prisma.passkey.count({ where: { userId: admin.id } }),
    profileEmailAvailable()
  ]);
  const linkedProvider = providers.find((provider) =>
    linkedIdentities.some((identity) => identity.provider === externalProviderKey(provider))
  );

  return (
    <ProfileFlowPreview
      initial={{
        emailCodeAvailable,
        hasPasskey: passkeyCount > 0,
        linkedProvider: Boolean(linkedProvider),
        passwordAvailable: settings.localLoginEnabled,
        totpEnabled: Boolean(admin.totpCredential?.enabled)
      }}
      name={admin.name || "Preview account"}
      currentEmail={admin.email}
      providerName={linkedProvider?.label || providers[0]?.label || "Example provider"}
    />
  );
}
