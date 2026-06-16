"use client";

import { Bookmark, Check, Copy } from "lucide-react";
import { type MouseEvent, useEffect, useRef, useState } from "react";

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

export function BookmarkletLink({
  bookmarklet,
  bookmarkTitle = "ShortenURL",
  label
}: {
  bookmarklet: string;
  bookmarkTitle?: string;
  label: string;
}) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const resetTimerRef = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    linkRef.current?.setAttribute("href", bookmarklet);
  }, [bookmarklet]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  function markCopied() {
    setCopied(true);
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
  }

  async function handleCopy(event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) {
    event.preventDefault();
    await copyToClipboard(bookmarklet);
    markCopied();
  }

  return (
    <div className="bookmarklet-control">
      <a
        ref={linkRef}
        className="button bookmarklet-button"
        href="#"
        draggable="true"
        aria-label={`${bookmarkTitle}. ${label}. Drag to your bookmarks bar.`}
        title={bookmarkTitle}
      >
        <Bookmark size={16} aria-hidden />
        {bookmarkTitle}
      </a>
      <button type="button" className="button secondary icon-button" onClick={handleCopy}>
        {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </button>
      <p className="bookmarklet-help muted small">
        Drag this to your bookmarks toolbar to save it as {bookmarkTitle}, then click that bookmark from a page you want to shorten.
        Use Copy if you want the bookmarklet code.
      </p>
    </div>
  );
}
