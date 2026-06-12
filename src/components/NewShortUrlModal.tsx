"use client";

import { Plus, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { DestinationWarnings } from "./DestinationWarnings";
import { TitleAutoFill } from "./TitleAutoFill";

export function NewShortUrlModal({ csrf, siteName }: { csrf: string; siteName: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [destinationUrl, setDestinationUrl] = useState("");

  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) {
      return;
    }
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeDialog() {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  return (
    <>
      <button type="button" className="button" onClick={openDialog}>
        <Plus size={16} aria-hidden />
        Shorten URL
      </button>
      <dialog
        className="modal-dialog"
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        <div className="modal-panel">
          <div className="modal-header">
            <div>
              <h2 id={titleId}>New short URL</h2>
              <p className="muted small">Create a private {siteName} link from anywhere in the admin.</p>
            </div>
            <button type="button" className="icon-button secondary" onClick={closeDialog} aria-label="Close new short URL dialog">
              <X size={16} aria-hidden />
            </button>
          </div>
          <form className="form-stack" action="/admin/links/create" method="post" data-title-autofill="true">
            <input type="hidden" name="csrf" value={csrf} />
            <div className="form-grid">
              <label>
                Destination URL
                <input
                  name="destinationUrl"
                  onChange={(event) => setDestinationUrl(event.target.value)}
                  placeholder="https://example.com/page"
                  required
                  type="url"
                  value={destinationUrl}
                />
              </label>
              <DestinationWarnings value={destinationUrl} />
              <label>
                Custom alias
                <input name="code" placeholder="optional-alias" pattern="[A-Za-z0-9_-]{3,64}" />
              </label>
              <label>
                Title
                <input name="title" />
              </label>
              <label>
                Tags
                <input name="tags" placeholder="work, docs, client" />
              </label>
              <label>
                Expiration date
                <input name="expiresAt" type="datetime-local" />
              </label>
              <label>
                Max clicks
                <input name="maxClicks" type="number" min="1" />
              </label>
            </div>
            <label>
              Description
              <textarea name="description" />
            </label>
            <label>
              Internal notes
              <textarea name="notes" />
            </label>
            <div className="row-actions">
              <button type="submit">Create {siteName} link</button>
              <button type="button" className="secondary" onClick={closeDialog}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </dialog>
      <TitleAutoFill />
    </>
  );
}
