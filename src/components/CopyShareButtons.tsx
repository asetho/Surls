"use client";

import { Copy, Mail, Share2 } from "lucide-react";
import { useState } from "react";

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

  async function share() {
    const text = title || defaultTitle;
    if (navigator.share) {
      await navigator.share({ title: text, text, url }).catch(() => null);
      return;
    }
    const params = new URLSearchParams({ subject: text, body: url });
    window.location.href = `mailto:?${params.toString()}`;
  }

  const encoded = encodeURIComponent(url);
  const shareTitle = encodeURIComponent(title || defaultTitle);

  return (
    <>
      <div className="row-actions">
        <button type="button" className="icon-button secondary" onClick={copy} title="Copy short URL">
          <Copy size={16} aria-hidden />
          Copy
        </button>
        <button type="button" className="icon-button secondary" onClick={share} title="Share short URL">
          <Share2 size={16} aria-hidden />
          Share
        </button>
        <a className="button icon-button secondary" href={`mailto:?subject=${shareTitle}&body=${encoded}`} title="Share by email">
          <Mail size={16} aria-hidden />
          Email
        </a>
      </div>
      <div className="row-actions small" aria-label="Fallback share targets">
        <a href={`sms:?&body=${encoded}`}>SMS</a>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`}>Facebook</a>
        <a href={`https://twitter.com/intent/tweet?url=${encoded}&text=${shareTitle}`}>X/Twitter</a>
        <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`}>LinkedIn</a>
        <a href={`https://reddit.com/submit?url=${encoded}&title=${shareTitle}`}>Reddit</a>
        <a href={`https://wa.me/?text=${shareTitle}%20${encoded}`}>WhatsApp</a>
        <a href={`https://t.me/share/url?url=${encoded}&text=${shareTitle}`}>Telegram</a>
        <a href={`https://bsky.app/intent/compose?text=${shareTitle}%20${encoded}`}>Bluesky</a>
      </div>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </>
  );
}
