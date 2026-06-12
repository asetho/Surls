import type { ReactNode } from "react";
import type { CustomHtmlPage } from "@/lib/settings";
import { CustomLoginPageShell } from "@/components/CustomLoginPageShell";
import { parseLoginTemplate } from "@/lib/login-template";

export function LoginPageShell({
  children,
  customPage,
  tagline = "",
  title = ""
}: {
  children: ReactNode;
  customPage?: CustomHtmlPage | null;
  tagline?: string;
  title?: string;
}) {
  if (customPage && parseLoginTemplate(customPage.html)) {
    return (
      <CustomLoginPageShell html={customPage.html} tagline={tagline} title={title}>
        {children}
      </CustomLoginPageShell>
    );
  }

  return (
    <main className="login-shell">
      <div className="container">{children}</div>
    </main>
  );
}
