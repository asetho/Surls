import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { LoginFlowPreview } from "./LoginFlowPreview";
import { LoginPreviewLink } from "../../../login-dev/LoginPreviewLink";
import { adminLoginPath } from "@/lib/admin-login-path";
import { requireSiteAdmin } from "@/lib/auth";
import { pageFromFilesystem } from "@/lib/custom-pages";
import { hmservDevPreviewEnabled } from "@/lib/dev-preview";
import { getConfiguredExternalProviders } from "@/lib/external-provider-settings";
import { PROVIDER_LOGOS } from "@/lib/provider-logos";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Login flow preview",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ custom?: string | string[] }>;

export default async function LoginFlowPreviewPage({ searchParams }: { searchParams: SearchParams }) {
  if (!hmservDevPreviewEnabled()) notFound();
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminLoginPath("/admin/dev/login"));

  const [params, settings, filesystemLoginPage, providers, requestHeaders] = await Promise.all([
    searchParams,
    getSettings(),
    pageFromFilesystem("login"),
    getConfiguredExternalProviders(),
    headers()
  ]);
  const useCustom = params.custom !== "no";
  const customPage = useCustom ? filesystemLoginPage ?? settings.customLoginPage : null;
  const previewProviders = providers.map((provider) => ({
    label: provider.label,
    logo: provider.logoDataUrl || PROVIDER_LOGOS[provider.provider]
  }));

  return (
    <div className="admin-dev-preview">
      <nav className="login-dev-toolbar" aria-label="Login flow preview">
        <strong>hmserv dev · Login flow</strong>
        <LoginPreviewLink href="/admin/dev">Previews</LoginPreviewLink>
        <LoginPreviewLink href="/admin/dev/login?custom=yes" current={useCustom}>Custom</LoginPreviewLink>
        <LoginPreviewLink href="/admin/dev/login?custom=no" current={!useCustom}>Default</LoginPreviewLink>
        <LoginPreviewLink href="/admin/dev/profile">Profile flow</LoginPreviewLink>
        <LoginPreviewLink href="/login-dev">Static preview</LoginPreviewLink>
        {useCustom && !customPage ? <span>No custom login page is active</span> : null}
      </nav>
      <LoginFlowPreview
        customPage={customPage}
        localLoginEnabled={settings.localLoginEnabled}
        nonce={requestHeaders.get("x-nonce") ?? undefined}
        providers={previewProviders}
        siteName={settings.siteName}
      />
    </div>
  );
}
