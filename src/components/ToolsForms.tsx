"use client";

import { useActionState, useMemo, useState } from "react";
import { createTokenAction, checkDestinationAction, importCsvAction } from "@/app/admin/tools/actions";

export function ApiTokenForm({ csrf }: { csrf: string }) {
  const [state, action, pending] = useActionState(createTokenAction, null);
  return (
    <div className="form-stack">
      <form className="form-stack" action={action}>
        <input type="hidden" name="csrf" value={csrf} />
        <label>
          Token name
          <input name="name" defaultValue="Surls API token" />
        </label>
        <button type="submit" disabled={pending}>Generate API token</button>
      </form>
      {state?.token ? (
        <div className="success">
          <strong>Copy this token now. It will not be shown again.</strong>
          <code style={{ display: "block", overflowWrap: "anywhere" }}>{state.token}</code>
        </div>
      ) : null}
      {state?.error ? <div className="alert">{state.error}</div> : null}
    </div>
  );
}

export function LinkCheckerForm({ csrf }: { csrf: string }) {
  const [state, action, pending] = useActionState(checkDestinationAction, null);
  return (
    <form className="form-stack" action={action}>
      <input type="hidden" name="csrf" value={csrf} />
      <label>
        Destination URL
        <input name="url" type="url" placeholder="https://example.com" required />
      </label>
      <button type="submit" disabled={pending}>Check destination</button>
      {state?.message ? <div className={state.ok ? "success" : "alert"}>{state.message}</div> : null}
    </form>
  );
}

export function ImportCsvForm({ csrf }: { csrf: string }) {
  const [state, action, pending] = useActionState(importCsvAction, null);
  return (
    <form className="form-stack" action={action}>
      <input type="hidden" name="csrf" value={csrf} />
      <label>
        CSV rows
        <textarea name="csv" placeholder="https://example.com,custom-alias,Optional title" />
      </label>
      <label>
        <span>
          <input name="confirm" type="checkbox" style={{ width: "auto", minHeight: "auto" }} /> Confirm import
        </span>
        <span className="muted small">Leave unchecked to preview validation errors without importing.</span>
      </label>
      <button type="submit" disabled={pending}>Validate or import CSV</button>
      {state?.imported ? <div className="success">Imported {state.imported} links.</div> : null}
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
      {built ? <code style={{ overflowWrap: "anywhere" }}>{built}</code> : <p className="muted">Enter a valid URL to build UTM parameters.</p>}
    </div>
  );
}
