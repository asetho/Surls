"use client";

import { X } from "lucide-react";

export function BookmarkletPopupActions({ detailsHref }: { detailsHref: string }) {
  function closeAfterOpenDetails() {
    window.setTimeout(() => window.close(), 150);
  }

  return (
    <div className="row-actions bookmarklet-popup-actions">
      <button type="button" className="danger" onClick={() => window.close()}>
        <X size={16} aria-hidden />
        Close
      </button>
      <a className="button secondary" href={detailsHref} target="_blank" rel="noreferrer" onClick={closeAfterOpenDetails}>
        Open details
      </a>
    </div>
  );
}
