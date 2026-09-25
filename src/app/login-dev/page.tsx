import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { LoginPageShell } from "@/components/LoginPageShell";
import { PasswordLoginForm } from "@/components/PasswordLoginForm";
import { LoginPreviewLink } from "./LoginPreviewLink";
import { LoginPreviewSurface } from "./LoginPreviewSurface";
import { adminLoginPath } from "@/lib/admin-login-path";
import { requireSiteAdmin } from "@/lib/auth";
import { pageFromFilesystem } from "@/lib/custom-pages";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Login preview",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ custom?: string | string[] }>;

export default async function LoginDevPage({ searchParams }: { searchParams: SearchParams }) {
  if (!env.SURLS_LOGIN_DEV_ENABLED) notFound();
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminLoginPath("/login-dev"));

  const [params, settings, filesystemLoginPage, requestHeaders] = await Promise.all([
    searchParams,
    getSettings(),
    pageFromFilesystem("login"),
    headers()
  ]);
  const useCustom = params.custom !== "no";
  const customPage = useCustom ? filesystemLoginPage ?? settings.customLoginPage : null;
  const title = `${settings.siteName} login`;
  const tagline = "Sign in to manage private links, redirects, and click statistics.";

  return (
    <>
      <nav className="login-dev-toolbar" aria-label="Login preview">
        <strong>Login preview</strong>
        <LoginPreviewLink href="/login-dev?custom=yes" current={useCustom}>Custom</LoginPreviewLink>
        <LoginPreviewLink href="/login-dev?custom=no" current={!useCustom}>Default</LoginPreviewLink>
        <LoginPreviewLink href="/admin/settings">Settings</LoginPreviewLink>
        {useCustom && !customPage ? <span>No custom login page is active</span> : null}
      </nav>
      <LoginPreviewSurface>
        <LoginPageShell
          customPage={customPage}
          nonce={requestHeaders.get("x-nonce") ?? undefined}
          tagline={tagline}
          title={title}
        >
          <PasswordLoginForm
            csrf=""
            preview
            embedded={Boolean(customPage)}
            nextPath="/admin"
            siteName={settings.siteName}
            localLoginEnabled={settings.localLoginEnabled}
          />
        </LoginPageShell>
      </LoginPreviewSurface>
    </>
  );
}
