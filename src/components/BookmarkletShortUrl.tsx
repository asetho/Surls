"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through when the browser denies clipboard access.
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

export function BookmarkletShortUrl({ url }: { url: string }) {
  const resetTimerRef = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  async function copy() {
    await copyToClipboard(url);
    setCopied(true);
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <span className="bookmarklet-copy-field bookmarklet-short-url-value">
      <a href={url} target="_blank" rel="noreferrer">
        <span>{url}</span>
      </a>
      <button type="button" className="secondary icon-button" onClick={copy}>
        {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </button>
    </span>
  );
}
