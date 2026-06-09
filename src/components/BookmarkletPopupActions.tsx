"use client";

import { Check, Copy, X } from "lucide-react";
import { useState } from "react";

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the textarea copy path when the browser denies clipboard writes.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function BookmarkletPopupActions({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await copyToClipboard(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="row-actions bookmarklet-popup-actions">
      <button type="button" onClick={copy}>
        {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
        {copied ? "Copied" : "Copy short URL"}
      </button>
      <button type="button" className="secondary" onClick={() => window.close()}>
        <X size={16} aria-hidden />
        Close
      </button>
    </div>
  );
}
