"use client";

import { useMemo, useSyncExternalStore } from "react";

function escapeHtmlAttribute(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function hashBootstrap(hash: string, nonce?: string | null) {
  if (!hash) return "";
  const nonceAttribute = nonce?.trim() ? ` nonce="${escapeHtmlAttribute(nonce)}"` : "";
  return `<script${nonceAttribute}>try{history.replaceState(null,"","about:srcdoc"+${JSON.stringify(hash)});}catch{}</script>`;
}

export function CustomHtmlFrame({ html, nonce }: { html: string; nonce?: string | null }) {
  const initialHash = useSyncExternalStore(
    (callback) => {
      window.addEventListener("hashchange", callback);
      return () => window.removeEventListener("hashchange", callback);
    },
    () => window.location.hash,
    () => ""
  );

  const srcDoc = useMemo(() => `${hashBootstrap(initialHash, nonce)}${html}`, [html, initialHash, nonce]);

  return (
    <iframe
      className="custom-html-page-frame"
      srcDoc={srcDoc}
      title="Custom page"
      sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
    />
  );
}
