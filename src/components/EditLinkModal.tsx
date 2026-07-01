"use client";

import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { updateLinkAction } from "@/app/admin/links/actions";
import { dispatchAdminToast } from "@/lib/admin-toast-event";
import { DestinationWarnings } from "./DestinationWarnings";
import { TitleAutoFill } from "./TitleAutoFill";

type EditableLink = {
  id: string;
  code: string;
  destinationUrl: string;
  title: string;
  expiresAt: string;
  maxClicks: number | null;
  enabled: boolean;
  description: string;
  notes: string;
};

export function EditLinkModal({
  compact = false,
  csrf,
  link
}: {
  compact?: boolean;
  csrf: string;
  link: EditableLink;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [destinationUrl, setDestinationUrl] = useState(link.destinationUrl);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog || dialog.open) {
      return;
    }
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }, [isOpen]);

  function openDialog() {
    setIsOpen(true);
  }

  function closeDialog() {
    const dialog = dialogRef.current;
    if (dialog) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
    setIsOpen(false);
  }

  async function saveLink(formData: FormData) {
    setIsSaving(true);
    try {
      await updateLinkAction(formData);
      closeDialog();
      router.refresh();
      dispatchAdminToast("success", "Link saved.");
    } catch (error) {
      dispatchAdminToast("error", error instanceof Error ? error.message : "Could not save that link.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`secondary icon-button${compact ? " icon-only-action" : ""}`}
        onClick={openDialog}
        aria-label={compact ? `Edit /${link.code}` : undefined}
        title={compact ? `Edit /${link.code}` : undefined}
      >
        <Pencil size={16} aria-hidden />
        {compact ? null : "Edit"}
      </button>
      <dialog
        className="modal-dialog"
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
        onClose={() => setIsOpen(false)}
      >
        {isOpen ? (
          <div className="modal-panel">
            <div className="modal-header">
              <div>
                <h2 id={titleId}>Edit /{link.code}</h2>
                <p className="muted small">Update the destination, title, limits, and notes for this short URL.</p>
              </div>
              <button type="button" className="icon-button secondary" onClick={closeDialog} aria-label="Close edit link dialog">
                <X size={16} aria-hidden />
              </button>
            </div>
            <form className="form-stack" action={saveLink} data-title-autofill="true">
              <input type="hidden" name="csrf" value={csrf} />
              <input type="hidden" name="id" value={link.id} />
              <div className="form-grid">
                <label>
                  Destination URL
                  <input
                    name="destinationUrl"
                    onChange={(event) => setDestinationUrl(event.target.value)}
                    required
                    type="url"
                    value={destinationUrl}
                  />
                </label>
                <DestinationWarnings value={destinationUrl} />
                <label>
                  Title
                  <input name="title" defaultValue={link.title} />
                </label>
                <label>
                  Expiration date
                  <input name="expiresAt" type="datetime-local" defaultValue={link.expiresAt} />
                </label>
                <label>
                  Max clicks
                  <input name="maxClicks" type="number" min="1" defaultValue={link.maxClicks ?? ""} />
                </label>
              </div>
              <label>
                <span>
                  <input
                    className="inline-control"
                    name="enabled"
                    type="checkbox"
                    defaultChecked={link.enabled}
                  />{" "}
                  Enabled
                </span>
              </label>
              <label>
                Description
                <textarea name="description" defaultValue={link.description} />
              </label>
              <label>
                Internal notes
                <textarea name="notes" defaultValue={link.notes} />
              </label>
              <div className="row-actions">
                <button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button type="button" className="danger" onClick={closeDialog}>
                  Cancel
                </button>
              </div>
            </form>
            <TitleAutoFill />
          </div>
        ) : null}
      </dialog>
    </>
  );
}
