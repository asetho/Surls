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

export function BookmarkletPopupActions({ detailsHref, url }: { detailsHref: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await copyToClipboard(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function closeAfterOpenDetails() {
    window.setTimeout(() => window.close(), 150);
  }

  return (
    <>
      <label className="bookmarklet-short-url-field">
        <span>Short URL</span>
        <div className="bookmarklet-copy-field">
          <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
          <button type="button" className="secondary icon-button" onClick={copy} aria-label="Copy short URL">
            {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </label>
      <div className="row-actions bookmarklet-popup-actions">
        <button type="button" className="secondary" onClick={() => window.close()}>
          <X size={16} aria-hidden />
          Close
        </button>
        <a className="button secondary" href={detailsHref} target="_blank" rel="noreferrer" onClick={closeAfterOpenDetails}>
          Open details
        </a>
      </div>
    </>
  );
}
