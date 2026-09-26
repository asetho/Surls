"use client";

import { X } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { disableTotpAction } from "@/app/admin/profile/actions";

export function DisableTotpForm({ csrf }: { csrf: string }) {
  const [state, action, pending] = useActionState(disableTotpAction, null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [suppressedState, setSuppressedState] = useState(state);
  const titleId = useId();

  useEffect(() => {
    if (state?.message) dialogRef.current?.close();
  }, [state?.message]);

  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    setSuppressedState(state);
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
    formRef.current?.reset();
  }

  return (
    <>
      <button className="danger" type="button" onClick={openDialog}>
        Disable TOTP
      </button>
      <dialog
        className="modal-dialog profile-security-dialog"
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === event.currentTarget && !pending) closeDialog();
        }}
        onClose={() => formRef.current?.reset()}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <div className="modal-panel delete-modal-panel">
          <div className="modal-header">
            <div>
              <h2 id={titleId}>Disable TOTP</h2>
              <p className="muted small">Enter a current authenticator code to disable TOTP sign-in.</p>
            </div>
            <button type="button" className="icon-button secondary" onClick={closeDialog} disabled={pending} aria-label="Close disable TOTP dialog">
              <X size={16} aria-hidden />
            </button>
          </div>
          <form className="form-stack" action={action} ref={formRef}>
            <input type="hidden" name="csrf" value={csrf} />
            <label>
              Current authenticator code
              <input name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus required />
            </label>
            {state?.error && state !== suppressedState ? <p className="alert" role="alert">{state.error}</p> : null}
            <div className="row-actions">
              <button className="danger" type="submit" disabled={pending}>
                {pending ? "Disabling..." : "Disable TOTP"}
              </button>
              <button className="secondary" type="button" onClick={closeDialog} disabled={pending}>Cancel</button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
