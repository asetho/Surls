"use client";

import { Check, Copy, RefreshCw, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { createTokenAction, checkDestinationAction, importCsvAction, rollTokenAction } from "@/app/admin/tools/actions";
import { dispatchAdminToast } from "@/lib/admin-toast-event";
import { AliasAvailabilityInput } from "./AliasAvailabilityInput";
import { ConfirmButton } from "./ConfirmButton";

export function UploadShortenForm({ csrf, maxUploadLabel }: { csrf: string; maxUploadLabel: string }) {
  const [state, setState] = useState<{
    code?: string;
    error?: string;
    fileUrl?: string;
    filename?: string;
    shortUrl?: string;
  } | null>(null);
  const [pending, setPending] = useState(false);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState(null);
    try {
      const response = await fetch("/api/uploads", {
        body: new FormData(event.currentTarget),
        headers: { "X-Surls-CSRF": csrf },
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as typeof state;
      if (!response.ok) {
        setState({ error: payload?.error || "Could not upload and shorten the file." });
      } else {
        setState(payload);
      }
    } catch {
      setState({ error: "Could not upload and shorten the file." });
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (state?.shortUrl) {
      dispatchAdminToast("success", `Uploaded ${state.filename ?? "file"} and created ${state.code}.`);
    } else if (state?.error) {
      dispatchAdminToast("error", state.error);
    }
  }, [state]);

  return (
    <form className="form-stack" onSubmit={upload} encType="multipart/form-data">
      <input type="hidden" name="csrf" value={csrf} />
      <label>
        File
        <input className="upload-file-input" name="file" type="file" required />
        <span className="muted small">Maximum upload: {maxUploadLabel}.</span>
      </label>
      <div className="form-grid">
        <label>
          Custom shortname
          <AliasAvailabilityInput />
        </label>
        <label>
          Custom title
          <input name="title" />
        </label>
      </div>
      <fieldset className="upload-options">
        <legend>Download filename</legend>
        <label className="choice-row">
          <input name="filenameMode" type="radio" value="original" />
          <span>Original filename</span>
        </label>
        <label className="choice-row">
          <input name="filenameMode" type="radio" value="safe" defaultChecked />
          <span>Browser-safe filename</span>
        </label>
        <label className="choice-row">
          <input name="filenameMode" type="radio" value="random" />
          <span>Randomized download name</span>
        </label>
        <label className="choice-row">
          <input name="dropExtension" type="checkbox" />
          <span>Drop extension</span>
        </label>
      </fieldset>
      <button type="submit" disabled={pending}>
        <Upload size={16} aria-hidden />
        {pending ? "Uploading..." : "Upload & Shorten"}
      </button>
      {state?.shortUrl ? (
        <div className="success upload-result">
          <strong>Created short URL</strong>
          <div className="bookmarklet-copy-field">
            <input readOnly value={state.shortUrl} onFocus={(event) => event.currentTarget.select()} aria-label="Created short URL" />
            <a className="button secondary" href={state.shortUrl} target="_blank" rel="noreferrer">
              Open
            </a>
          </div>
          {state.fileUrl ? (
            <p className="muted small">
              Stored file: <a href={state.fileUrl}>{state.filename}</a>
            </p>
          ) : null}
        </div>
      ) : null}
      {state?.error ? <div className="alert">{state.error}</div> : null}
    </form>
  );
}

export function ApiTokenForm({ csrf, siteName }: { csrf: string; siteName: string }) {
  const [state, action, pending] = useActionState(createTokenAction, null);
  const [dismissedToken, setDismissedToken] = useState<string | null>(null);
  return (
    <div className="form-stack">
      <form className="form-stack" action={action}>
        <input type="hidden" name="csrf" value={csrf} />
        <label>
          Token name
          <input name="name" defaultValue={`${siteName} API token`} />
        </label>
        <label>
          Expires after
          <select name="expiresInDays" defaultValue="90">
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="180">180 days</option>
            <option value="365">1 year</option>
            <option value="forever">Forever</option>
          </select>
          <span className="muted small">Tokens are limited to creating links and file uploads, and can be revoked or deleted anytime.</span>
        </label>
        <button type="submit" disabled={pending}>Generate API token</button>
      </form>
      <ApiTokenSecretModal
        description="Your new API token is ready. Store it securely before closing this window."
        onDismiss={() => setDismissedToken(state?.token ?? null)}
        title="New API token"
        token={state?.token === dismissedToken ? null : state?.token}
      />
      {state?.error ? <div className="alert">{state.error}</div> : null}
    </div>
  );
}

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
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy command failed.");
}

function ApiTokenSecretModal({
  description,
  onDismiss,
  title,
  token
}: {
  description: string;
  onDismiss: () => void;
  title: string;
  token?: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resetTimerRef = useRef<number | null>(null);
  const titleId = useId();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (token && dialog && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    }
  }, [token]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  function closeDialog() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
      setCopied(false);
      onDismiss();
    }
  }

  async function copyToken() {
    if (!token) return;
    try {
      await copyToClipboard(token);
      setCopied(true);
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
      dispatchAdminToast("success", "API token copied to clipboard.");
    } catch {
      dispatchAdminToast("error", "Could not copy the API token.");
    }
  }

  return (
    <dialog
      aria-labelledby={titleId}
      className="modal-dialog"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
      onClose={() => {
        setCopied(false);
        onDismiss();
      }}
      ref={dialogRef}
    >
      <div className="modal-panel api-token-modal-panel">
        <div className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            <p className="muted small">{description}</p>
          </div>
          <button type="button" className="icon-button secondary" onClick={closeDialog} aria-label="Close API token dialog">
            <X size={16} aria-hidden />
          </button>
        </div>
        <strong>Copy this token now. It will not be shown again.</strong>
        <div className="bookmarklet-copy-field">
          <input
            aria-label="New API token"
            autoComplete="off"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            spellCheck={false}
            value={token ?? ""}
          />
          <button type="button" className="secondary icon-button" onClick={copyToken}>
            {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
        <div className="row-actions">
          <button type="button" onClick={closeDialog}>Done</button>
        </div>
      </div>
    </dialog>
  );
}

export function ApiTokenRollButton({
  canRoll,
  csrf,
  id,
  name
}: {
  canRoll: boolean;
  csrf: string;
  id: string;
  name: string;
}) {
  const [state, action, pending] = useActionState(rollTokenAction, null);
  const [dismissedToken, setDismissedToken] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.error) dispatchAdminToast("error", state.error);
  }, [state]);

  function dismissToken() {
    setDismissedToken(state?.token ?? null);
    router.refresh();
  }

  return (
    <>
      {canRoll ? (
        <form action={action}>
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="id" value={id} />
          <ConfirmButton
            className="secondary icon-button"
            disabled={pending}
            message={`Roll ${name}? The existing API token will stop working immediately.`}
            type="submit"
          >
            <RefreshCw size={16} aria-hidden />
            {pending ? "Rolling..." : "Roll"}
          </ConfirmButton>
        </form>
      ) : null}
      <ApiTokenSecretModal
        description={`${state?.tokenName ?? name} was rolled successfully. The previous token is now revoked.`}
        onDismiss={dismissToken}
        title="Replacement API token"
        token={state?.token === dismissedToken ? null : state?.token}
      />
    </>
  );
}

export function LinkCheckerForm({ csrf }: { csrf: string }) {
  const [state, action, pending] = useActionState(checkDestinationAction, null);

  useEffect(() => {
    if (state?.message) {
      dispatchAdminToast(state.ok ? "info" : "error", state.message);
    }
  }, [state]);

  return (
    <form className="form-stack" action={action}>
      <input type="hidden" name="csrf" value={csrf} />
      <label>
        Destination URL
        <input name="url" type="url" placeholder="https://example.com" required />
      </label>
      <button type="submit" disabled={pending}>Check destination</button>
    </form>
  );
}

export function ImportCsvForm({ csrf }: { csrf: string }) {
  const [state, action, pending] = useActionState(importCsvAction, null);

  useEffect(() => {
    if (state?.imported) {
      dispatchAdminToast("success", `Imported ${state.imported} links.`);
    }
  }, [state]);

  return (
    <form className="form-stack" action={action}>
      <input type="hidden" name="csrf" value={csrf} />
      <label>
        CSV rows
        <textarea name="csv" placeholder="https://example.com,custom-alias,Optional title" />
      </label>
      <label>
        <span>
          <input className="inline-control" name="confirm" type="checkbox" /> Confirm import
        </span>
        <span className="muted small">Leave unchecked to preview validation errors without importing.</span>
      </label>
      <button type="submit" disabled={pending}>Validate or import CSV</button>
      {state?.errors?.length ? (
        <div className={state.errors[0]?.startsWith("Preview OK") ? "success" : "alert"}>
          {state.errors.map((error) => (
            <div key={error}>{error}</div>
          ))}
        </div>
      ) : null}
    </form>
  );
}

export function UtmBuilder() {
  const [base, setBase] = useState("");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const built = useMemo(() => {
    try {
      const url = new URL(base);
      if (source) url.searchParams.set("utm_source", source);
      if (medium) url.searchParams.set("utm_medium", medium);
      if (campaign) url.searchParams.set("utm_campaign", campaign);
      return url.toString();
    } catch {
      return "";
    }
  }, [base, source, medium, campaign]);

  return (
    <div className="form-stack">
      <label>
        Destination URL
        <input value={base} onChange={(event) => setBase(event.target.value)} placeholder="https://example.com" />
      </label>
      <div className="form-grid">
        <label>
          Source
          <input value={source} onChange={(event) => setSource(event.target.value)} />
        </label>
        <label>
          Medium
          <input value={medium} onChange={(event) => setMedium(event.target.value)} />
        </label>
        <label>
          Campaign
          <input value={campaign} onChange={(event) => setCampaign(event.target.value)} />
        </label>
      </div>
      {built ? <code className="code-wrap">{built}</code> : <p className="muted">Enter a valid URL to build UTM parameters.</p>}
    </div>
  );
}
