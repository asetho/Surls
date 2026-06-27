"use client";

import { type ReactNode, useLayoutEffect, useMemo, useRef } from "react";
import { renderLoginTemplateHtml } from "@/lib/login-template";

export function CustomLoginPageShell({
  children,
  html,
  nonce,
  tagline,
  title
}: {
  children: ReactNode;
  html: string;
  nonce?: string;
  tagline: string;
  title: string;
}) {
  const shellRef = useRef<HTMLElement | null>(null);
  const formHostRef = useRef<HTMLDivElement | null>(null);
  const renderedHtml = useMemo(() => renderLoginTemplateHtml(html, { tagline, title }) ?? "", [html, tagline, title]);

  useLayoutEffect(() => {
    const slot = shellRef.current?.querySelector("[data-surls-login-form-slot]");
    const formHost = formHostRef.current;
    if (slot && formHost && formHost.parentElement !== slot) {
      slot.appendChild(formHost);
    }
  }, [renderedHtml]);

  return (
    <>
      <main
        ref={shellRef}
        className="custom-html-page custom-login-page"
        data-surls-custom-page
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
      <div ref={formHostRef} className="surls-login-form-host" data-surls-login-form-host>
        {children}
      </div>
      <script
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `(() => {
  const moveLoginForm = () => {
    const shell = document.querySelector(".custom-login-page[data-surls-custom-page]");
    const slot = shell && shell.querySelector("[data-surls-login-form-slot]");
    const formHost = document.querySelector("[data-surls-login-form-host]");
    if (slot && formHost && formHost.parentElement !== slot) {
      slot.appendChild(formHost);
    }
  };
  if (document.readyState === "complete") {
    moveLoginForm();
  } else {
    window.addEventListener("load", moveLoginForm, { once: true });
  }
})();`
        }}
      />
    </>
  );
}
