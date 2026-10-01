"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, KeyRound, Trash2, X } from "lucide-react";
import { deleteBackupCodesAction, regenerateBackupCodesAction } from "@/app/admin/profile/actions";
import { formatDateTime } from "@/lib/dates";

const BACKUP_CODES_CONFIRMATION =
  "These backup codes are shown only once. Confirm you have saved, downloaded, or copied them before leaving this page.";
const REGENERATE_BACKUP_CODES_CONFIRMATION =
  "Regenerate backup codes? Your existing backup codes will stop working immediately.";

export function BackupCodesForm({
  backupCount,
  canDeleteBackupCodes,
  csrf,
  displayTimeZone,
  lastGeneratedAt
}: {
  backupCount: number;
  canDeleteBackupCodes: boolean;
  csrf: string;
  displayTimeZone: string;
  lastGeneratedAt: string | null;
}) {
  const [state, action, pending] = useActionState(regenerateBackupCodesAction, null);
  const regenerateDialogRef = useRef<HTMLDialogElement>(null);
  const regenerateTitleId = useId();
  const [deleteState, deleteAction, deletePending] = useActionState(deleteBackupCodesAction, null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const deleteTitleId = useId();
  const [acknowledgedCodesText, setAcknowledgedCodesText] = useState<string | null>(null);
  const [dismissedCodesText, setDismissedCodesText] = useState<string | null>(null);
  const [exportState, setExportState] = useState<{ codesText: string; message: string } | null>(null);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const codes = state?.codes;
  const codesText = useMemo(() => (codes ?? []).join("\n"), [codes]);
  const codesAcknowledged = !codesText || acknowledgedCodesText === codesText || Boolean(deleteState?.deleted);
  const showGeneratedCodes = Boolean(codes?.length && dismissedCodesText !== codesText && !deleteState?.deleted);
  const exportMessage = exportState?.codesText === codesText ? exportState.message : null;
  const hasBackupCodes = !deleteState?.deleted && (backupCount > 0 || Boolean(codes?.length));
  const buttonLabel = hasBackupCodes ? "Regenerate backup codes" : "Generate backup codes";
  const shouldWarnBeforeLeaving = Boolean(codesText) && !codesAcknowledged;
  const generatedAt = state?.generatedAt ?? lastGeneratedAt;
  const generatedAtLabel = useMemo(() => {
    if (!generatedAt) return "Never generated";
    const date = new Date(generatedAt);
    return Number.isNaN(date.getTime()) ? "Never generated" : formatDateTime(date, displayTimeZone);
  }, [displayTimeZone, generatedAt]);

  useEffect(() => {
    if (deleteState?.deleted) {
      deleteDialogRef.current?.close();
      window.location.reload();
    }
  }, [deleteState]);

  useEffect(() => {
    if (state?.codes?.length) regenerateDialogRef.current?.close();
  }, [state]);

  useEffect(() => {
    if (!shouldWarnBeforeLeaving) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function confirmSaved() {
      const confirmed = window.confirm(BACKUP_CODES_CONFIRMATION);
      if (confirmed) setAcknowledgedCodesText(codesText);
      return confirmed;
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.download || (anchor.target && anchor.target !== "_self")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const url = new URL(href, window.location.href);
      const samePage =
        url.origin === window.location.origin &&
        url.pathname === window.location.pathname &&
        url.search === window.location.search;

      if (samePage) return;
      if (confirmSaved()) return;

      event.preventDefault();
      event.stopPropagation();
    }

    function handleDocumentSubmit(event: SubmitEvent) {
      if (event.defaultPrevented) return;
      if (confirmSaved()) return;

      event.preventDefault();
      event.stopPropagation();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("submit", handleDocumentSubmit, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
      document.removeEventListener("submit", handleDocumentSubmit, true);
    };
  }, [codesText, shouldWarnBeforeLeaving]);

  async function copyBackupCodes() {
    if (!codesText) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(codesText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = codesText;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.top = "-1000px";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("Copy command failed.");
      }
      setExportState({ codesText, message: "Backup codes copied." });
    } catch {
      setExportState({ codesText, message: "Could not copy backup codes. Select and copy them manually." });
    }
  }

  function downloadBackupCodes() {
    if (!codesText) return;

    const contents = [
      "Surls backup codes",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "Store these securely. Each backup code can be used once.",
      "",
      codesText
    ].join("\n");
    const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `surls-backup-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setExportState({ codesText, message: "Backup codes download started." });
  }

  return (
    <div className="form-stack">
      <div className="backup-codes-actions">
        <button type="button" onClick={() => regenerateDialogRef.current?.showModal()}>
          <KeyRound size={16} aria-hidden /> {buttonLabel}
        </button>
        <dialog className="modal-dialog profile-security-dialog" ref={regenerateDialogRef} aria-labelledby={regenerateTitleId}
          onClick={(event) => { if (event.target === event.currentTarget && !pending) event.currentTarget.close(); }}>
          <div className="modal-panel delete-modal-panel">
            <div className="modal-header"><div><h2 id={regenerateTitleId}>{buttonLabel}</h2>
              <p className="muted small">{hasBackupCodes ? REGENERATE_BACKUP_CODES_CONFIRMATION : "Verify your identity to create backup codes."}</p></div>
              <button type="button" className="icon-button secondary" aria-label="Close backup code dialog" onClick={() => regenerateDialogRef.current?.close()} disabled={pending}><X size={16} aria-hidden /></button>
            </div>
            <form className="form-stack" action={action}>
              <input type="hidden" name="csrf" value={csrf} />
              <label>{useBackupCode ? "Unused backup code" : "Current authenticator code"}
                <input key={useBackupCode ? "backup" : "totp"} name="code" inputMode={useBackupCode ? "text" : "numeric"}
                  autoComplete={useBackupCode ? "off" : "one-time-code"} pattern={useBackupCode ? undefined : "[0-9]{6}"} required />
              </label>
              {hasBackupCodes ? <button className="secondary" type="button" onClick={() => setUseBackupCode(!useBackupCode)}>
                {useBackupCode ? "Use an authenticator code" : "Use a backup code instead"}
              </button> : null}
              {state?.error ? <p className="alert" role="alert">{state.error}</p> : null}
              <div className="row-actions"><button type="submit" disabled={pending}>{buttonLabel}</button>
                <button className="secondary" type="button" onClick={() => regenerateDialogRef.current?.close()} disabled={pending}>Cancel</button></div>
            </form>
          </div>
        </dialog>
        {canDeleteBackupCodes && hasBackupCodes ? (
          <>
            <button className="danger-outline" type="button" onClick={() => deleteDialogRef.current?.showModal()}>
              <Trash2 size={16} aria-hidden /> Delete backup codes
            </button>
            <dialog className="modal-dialog profile-security-dialog" ref={deleteDialogRef} aria-labelledby={deleteTitleId}
              onClick={(event) => { if (event.target === event.currentTarget && !deletePending) event.currentTarget.close(); }}>
              <div className="modal-panel delete-modal-panel">
                <div className="modal-header"><div><h2 id={deleteTitleId}>Delete backup codes</h2>
                  <p className="muted small">These codes will stop working immediately. Verify with your current authenticator to continue.</p></div>
                  <button type="button" className="icon-button secondary" aria-label="Close delete backup codes dialog" onClick={() => deleteDialogRef.current?.close()}><X size={16} aria-hidden /></button>
                </div>
                <form className="form-stack" action={deleteAction}>
                  <input type="hidden" name="csrf" value={csrf} />
                  <label>Current authenticator code
                    <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required />
                  </label>
                  {deleteState?.error ? <p className="alert" role="alert">{deleteState.error}</p> : null}
                  <div className="row-actions"><button className="danger" type="submit" disabled={deletePending}>Delete backup codes</button>
                    <button className="secondary" type="button" onClick={() => deleteDialogRef.current?.close()}>Cancel</button></div>
                </form>
              </div>
            </dialog>
          </>
        ) : null}
      </div>
      <p className="backup-codes-meta muted small">Last generated: {generatedAtLabel}</p>
      {showGeneratedCodes ? (
        <div className="success backup-codes-result">
          <strong>Store these backup codes now. They are shown only this once.</strong>
          <p className="muted small">Copy or download the codes, then confirm once you have saved them.</p>
          <div className="backup-code-actions">
            <button type="button" className="secondary" onClick={copyBackupCodes}>
              <Copy size={16} aria-hidden />
              Copy codes
            </button>
            <button type="button" className="secondary" onClick={downloadBackupCodes}>
              <Download size={16} aria-hidden />
              Download .txt
            </button>
            <button
              type="button"
              onClick={() => {
                setAcknowledgedCodesText(codesText);
                setDismissedCodesText(codesText);
              }}
              disabled={codesAcknowledged}
            >
              <Check size={16} aria-hidden />
              {codesAcknowledged ? "Saved confirmed" : "I saved these codes"}
            </button>
          </div>
          {exportMessage ? (
            <p className="backup-code-feedback small" aria-live="polite">
              {exportMessage}
            </p>
          ) : null}
          <div className="form-grid backup-code-grid">
            {(codes ?? []).map((code) => (
              <code key={code}>{code}</code>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
