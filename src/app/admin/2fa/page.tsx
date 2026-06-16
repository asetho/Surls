import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginPageShell } from "@/components/LoginPageShell";
import { TwoFactorLoginForm } from "@/components/TwoFactorLoginForm";
import { requireAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { pageFromFilesystem } from "@/lib/custom-pages";
import { decodePendingLogin, PENDING_LOGIN_COOKIE } from "@/lib/pending-login";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Two-Factor Login"
};

type SearchParams = Promise<{ error?: string }>;

export default async function TwoFactorLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const [params, currentUser, cookieStore] = await Promise.all([
    searchParams,
    requireAdmin(),
    cookies()
  ]);
  if (currentUser) redirect("/admin");

  const pendingLogin = decodePendingLogin(cookieStore.get(PENDING_LOGIN_COOKIE)?.value);
  if (!pendingLogin) redirect("/admin?error=Sign%20in%20again%20to%20continue.");

  const [settings, filesystemLoginPage] = await Promise.all([getSettings(), pageFromFilesystem("login")]);
  const customLoginPage = filesystemLoginPage ?? settings.customLoginPage;
  const title = "Enter your 2FA code";
  const tagline = `Finish signing in to ${settings.siteName} as\n${pendingLogin.email}.`;

  return (
    <LoginPageShell customPage={customLoginPage} tagline={tagline} title={title}>
      <TwoFactorLoginForm
        csrf={getCsrfToken()}
        embedded={Boolean(customLoginPage)}
        email={pendingLogin.email}
        error={params.error}
        siteName={settings.siteName}
      />
    </LoginPageShell>
  );
}
