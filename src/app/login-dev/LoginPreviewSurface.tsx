"use client";

import type { ReactNode } from "react";

export function LoginPreviewSurface({ children }: { children: ReactNode }) {
  return (
    <div
      className="login-dev-preview"
      onClickCapture={(event) => {
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
