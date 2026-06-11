"use client";

import { Copy, Share2 } from "lucide-react";
import { useState } from "react";

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
  const [toast, setToast] = useState("");

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast("Copied share link!");
      window.setTimeout(() => setToast(""), 1600);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setToast("Share failed.");
      window.setTimeout(() => setToast(""), 1600);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`secondary icon-button${compact ? " icon-only-action" : ""}`}
        onClick={share}
        aria-label="Share short URL"
        title="Share short URL"
      >
        <Share2 size={16} aria-hidden />
        {compact ? null : <span className="share-button-label">Share</span>}
      </button>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </>
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
