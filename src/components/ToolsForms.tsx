"use client";

import { Upload } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { createTokenAction, checkDestinationAction, importCsvAction, uploadAndShortenAction } from "@/app/admin/tools/actions";
import { dispatchAdminToast } from "@/lib/admin-toast-event";

export function UploadShortenForm({ csrf, maxUploadLabel }: { csrf: string; maxUploadLabel: string }) {
  const [state, action, pending] = useActionState(uploadAndShortenAction, null);

  useEffect(() => {
    if (state?.shortUrl) {
      dispatchAdminToast("success", `Uploaded ${state.filename ?? "file"} and created ${state.code}.`);
    } else if (state?.error) {
      dispatchAdminToast("error", state.error);
    }
  }, [state]);

  return (
    <form className="form-stack" action={action} encType="multipart/form-data">
      <input type="hidden" name="csrf" value={csrf} />
      <label>
        File
        <input className="upload-file-input" name="file" type="file" required />
        <span className="muted small">Maximum upload: {maxUploadLabel}.</span>
      </label>
      <div className="form-grid">
        <label>
          Custom shortname
          <input name="code" placeholder="optional-alias" pattern="[A-Za-z0-9_-]{3,64}" />
        </label>
        <label>
          Custom title
          <input name="title" />
        </label>
      </div>
      <fieldset className="upload-options">
        <legend>Filename conversion</legend>
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
          <span>Randomized filename</span>
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
          <span className="muted small">Tokens are limited to creating links and can be revoked or deleted anytime.</span>
        </label>
        <button type="submit" disabled={pending}>Generate API token</button>
      </form>
      {state?.token ? (
        <div className="success">
          <strong>Copy this token now. It will not be shown again.</strong>
          <code className="code-block">{state.token}</code>
        </div>
      ) : null}
      {state?.error ? <div className="alert">{state.error}</div> : null}
    </div>
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
