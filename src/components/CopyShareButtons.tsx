"use client";

import { Copy, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

const ADDTOANY_SRC = "https://static.addtoany.com/menu/page.js";
const ADDTOANY_SERVICES = [
  "email",
  "sms",
  "facebook",
  "x",
  "linkedin",
  "reddit",
  "whatsapp",
  "telegram",
  "bluesky"
];

declare global {
  interface Window {
    a2a?: { init_all?: () => void };
    a2a_config?: {
      native?: boolean;
      num_services?: number;
      onclick?: number | boolean;
      prioritize?: string[];
    };
    __surlsAddToAnyScript?: Promise<void>;
  }
}

function configureAddToAny() {
  if (typeof window === "undefined") return;
  window.a2a_config = window.a2a_config || {};
  window.a2a_config.native = false;
  window.a2a_config.onclick = 1;
  window.a2a_config.num_services = 10;
  window.a2a_config.prioritize = ADDTOANY_SERVICES;
}

function loadAddToAny() {
  if (typeof window === "undefined") return Promise.resolve();
  configureAddToAny();
  if (window.a2a?.init_all) return Promise.resolve();
  if (window.__surlsAddToAnyScript) return window.__surlsAddToAnyScript;

  window.__surlsAddToAnyScript = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${ADDTOANY_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("AddToAny failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = ADDTOANY_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("AddToAny failed to load.")), { once: true });
    document.body.appendChild(script);
  });

  return window.__surlsAddToAnyScript;
}

export function CopyShareButtons({
  url,
  title,
  defaultTitle = "Short link"
}: {
  url: string;
  title?: string | null;
  defaultTitle?: string;
}) {
  const [toast, setToast] = useState("");
  const shareTitle = title || defaultTitle;

  useEffect(() => {
    let cancelled = false;
    loadAddToAny()
      .then(() => {
        if (!cancelled) window.a2a?.init_all?.();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [shareTitle, url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setToast("Copied!");
    window.setTimeout(() => setToast(""), 1600);
  }

  return (
    <>
      <div className="row-actions">
        <button type="button" className="icon-button secondary" onClick={copy} title="Copy short URL">
          <Copy size={16} aria-hidden />
          Copy
        </button>
        <div
          className="a2a_kit a2a_default_style addtoany-share"
          data-a2a-url={url}
          data-a2a-title={shareTitle}
        >
          <a
            className="a2a_dd button secondary icon-button addtoany-share-button"
            href="https://www.addtoany.com/share"
            aria-label="Share short URL"
            title="Share short URL"
          >
            <Share2 size={16} aria-hidden />
            <span className="share-button-label">Share</span>
          </a>
        </div>
      </div>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </>
  );
}
