"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { enrollTotpAction } from "@/app/admin/profile/actions";

export function TotpEnrollmentForm({ csrf }: { csrf: string }) {
  const [state, action, pending] = useActionState(enrollTotpAction, null);
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState("");
  const codes = state?.codes ?? [];
  const codesText = codes.join("\n");

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(codesText);
      setFeedback("Backup codes copied.");
    } catch {
      setFeedback("Copy failed. Select the codes and copy them manually.");
    }
  }

  function downloadCodes() {
    const blob = new Blob([`Surls backup codes\n\n${codesText}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `surls-backup-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setFeedback("Backup codes download started.");
  }

  return (
    <div className="form-stack">
      {state?.error ? <p className="alert" role="alert">{state.error}</p> : null}
      {!codes.length ? (
        <form className="form-stack totp-verify-form" action={action}>
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="step" value="verify" />
          <label className="totp-verification-field">
            Verification code
            <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required />
          </label>
          <button type="submit" disabled={pending}>Verify authenticator</button>
        </form>
      ) : (
        <div className="form-stack backup-codes-result success">
          <strong>Save these backup codes before enabling TOTP. They will not be shown again. Confirm within 10 minutes.</strong>
          <div className="form-grid backup-code-grid">
            {codes.map((code) => <code key={code}>{code}</code>)}
          </div>
          <div className="row-actions">
            <button type="button" className="secondary" onClick={copyCodes}><Copy size={16} aria-hidden />Copy codes</button>
            <button type="button" className="secondary" onClick={downloadCodes}><Download size={16} aria-hidden />Download .txt</button>
          </div>
          {feedback ? <p className="small" role="status">{feedback}</p> : null}
          <form className="form-stack" action={action}>
            <input type="hidden" name="csrf" value={csrf} />
            <input type="hidden" name="step" value="confirm" />
            <input type="hidden" name="confirmationNonce" value={state?.confirmationNonce ?? ""} />
            <label className="totp-saved-confirmation">
              <input type="checkbox" name="codesSaved" value="yes" checked={saved} onChange={(event) => setSaved(event.target.checked)} required />
              I saved these backup codes in a safe place.
            </label>
            <button type="submit" disabled={!saved || pending}><Check size={16} aria-hidden />Enable TOTP</button>
          </form>
        </div>
      )}
    </div>
  );
}
