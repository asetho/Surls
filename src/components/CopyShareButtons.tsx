"use client";

import { Copy, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  ADDTOANY_PRIORITIZED_SERVICES,
  ADDTOANY_SCRIPT_ID,
  ADDTOANY_SCRIPT_SRC
} from "@/lib/addtoany";

type AddToAnyWindow = Window & {
  a2a?: {
    init_all?: () => void;
  };
  a2a_config?: {
    prioritize?: string[];
  };
};

function setupAddToAny() {
  const addToAnyWindow = window as AddToAnyWindow;
  addToAnyWindow.a2a_config = addToAnyWindow.a2a_config || {};
  addToAnyWindow.a2a_config.prioritize = [...ADDTOANY_PRIORITIZED_SERVICES];

  if (addToAnyWindow.a2a?.init_all) {
    addToAnyWindow.a2a.init_all();
    return;
  }

  const existingScript = document.getElementById(ADDTOANY_SCRIPT_ID) as HTMLScriptElement | null;
  if (existingScript) return;

  const script = document.createElement("script");
  script.id = ADDTOANY_SCRIPT_ID;
  script.async = true;
  script.src = ADDTOANY_SCRIPT_SRC;
  script.addEventListener("load", () => addToAnyWindow.a2a?.init_all?.());
  document.body.appendChild(script);
}

export function CopyShortUrlButton({ compact = false, url }: { compact?: boolean; url: string }) {
  const [toast, setToast] = useState("");

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
      <button
        type="button"
        className={`icon-button secondary${compact ? " icon-only-action" : ""}`}
        onClick={copy}
        aria-label={compact ? "Copy short URL" : undefined}
        title="Copy short URL"
      >
        <Copy size={16} aria-hidden />
        {compact ? null : "Copy"}
      </button>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </>
  );
}

export function ShareButton({
  compact = false,
  url,
  title,
  defaultTitle = "Short link"
}: {
  compact?: boolean;
  url: string;
  title?: string | null;
  defaultTitle?: string;
}) {
  const shareTitle = title || defaultTitle;

  useEffect(() => {
    setupAddToAny();
  }, [shareTitle, url]);

  return (
    <div className="addtoany-share a2a_kit" data-a2a-title={shareTitle} data-a2a-url={url}>
      <a
        className={`button secondary icon-button addtoany-share-button a2a_dd${compact ? " icon-only-action" : ""}`}
        href="https://www.addtoany.com/share"
        aria-label="Share short URL"
        rel="noopener noreferrer"
        target="_blank"
        title="Share short URL"
      >
        <Share2 size={16} aria-hidden />
        {compact ? null : <span className="share-button-label">Share</span>}
      </a>
    </div>
  );
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
  return (
    <>
      <div className="row-actions">
        <CopyShortUrlButton url={url} />
        <ShareButton url={url} title={title} defaultTitle={defaultTitle} />
      </div>
    </>
  );
}
