"use client";

import type { ReactNode } from "react";

export function LoginPreviewSurface({ children }: { children: ReactNode }) {
  return (
    <div
      className="login-dev-preview"
      onClickCapture={(event) => {
        const previewCheck = event.target instanceof Element ? event.target.closest("button[data-surls-preview-check]") : null;
        if (previewCheck?.closest("[data-surls-turnstile-preview]")) {
          event.preventDefault();
          return;
        }
        const flowButton = event.target instanceof Element ? event.target.closest("[data-surls-login-flow] button") : null;
        if (flowButton) {
          event.preventDefault();
          return;
        }
        if (event.target instanceof Element && event.target.closest("a, button, [role='button'], [role='link'], input[type='submit']")) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onSubmitCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {children}
    </div>
  );
}
