"use client";

import { Trash2, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { deleteLinkAction } from "@/app/admin/links/actions";

function normalizeConfirmation(value: string) {
  const text = value.trim();
  if (!text) return "";

  try {
    return new URL(text).pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  } catch {
    return text.replace(/^\/+/, "").replace(/\/+$/, "");
  }
}

export function DeleteLinkModal({
  code,
  csrf,
  id,
  returnTo,
  shortUrl
}: {
  code: string;
  csrf: string;
  id: string;
  returnTo: string;
  shortUrl: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [confirmation, setConfirmation] = useState("");
  const isConfirmed = normalizeConfirmation(confirmation) === code;

  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeDialog() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
    setConfirmation("");
  }

  return (
    <>
      <button type="button" className="danger-outline icon-button" onClick={openDialog}>
        <Trash2 size={16} aria-hidden />
        Delete
      </button>
      <dialog
        className="modal-dialog"
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
        onClose={() => setConfirmation("")}
      >
        <div className="modal-panel delete-modal-panel">
          <div className="modal-header">
            <div>
              <h2 id={titleId}>Delete /{code}</h2>
              <p className="muted small">This permanently removes the link and its click history.</p>
            </div>
            <button type="button" className="icon-button secondary" onClick={closeDialog} aria-label="Close delete link dialog">
              <X size={16} aria-hidden />
            </button>
          </div>
          <form className="form-stack" action={deleteLinkAction}>
            <input type="hidden" name="csrf" value={csrf} />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <div className="delete-confirm-target">
              <span className="muted small">Short URL</span>
              <strong>{shortUrl}</strong>
            </div>
            <label>
              Type /{code} to confirm deletion
              <input
                name="confirmCode"
                autoComplete="off"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={`/${code}`}
                required
              />
            </label>
            <div className="row-actions">
              <button type="submit" className="danger icon-button" disabled={!isConfirmed}>
                <Trash2 size={16} aria-hidden />
                Delete
              </button>
              <button type="button" className="secondary" onClick={closeDialog}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
