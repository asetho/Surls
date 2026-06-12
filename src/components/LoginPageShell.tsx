import type { ReactNode } from "react";
import type { CustomHtmlPage } from "@/lib/settings";
import { splitLoginFormPlaceholder } from "@/lib/custom-pages";

export function LoginPageShell({ children, customPage }: { children: ReactNode; customPage?: CustomHtmlPage | null }) {
  if (customPage) {
    const parts = splitLoginFormPlaceholder(customPage.html);
    if (parts) {
      return (
        <main className="custom-html-page custom-login-page" data-surls-custom-page>
          {parts.before ? <div dangerouslySetInnerHTML={{ __html: parts.before }} /> : null}
          {children}
          {parts.after ? <div dangerouslySetInnerHTML={{ __html: parts.after }} /> : null}
        </main>
      );
    }
  }

  return (
    <main className="login-shell">
      <div className="container">{children}</div>
    </main>
  );
}
