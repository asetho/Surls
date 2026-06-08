"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { regenerateBackupCodesAction } from "@/app/admin/profile/actions";

export function BackupCodesForm({ csrf }: { csrf: string }) {
  const [state, action, pending] = useActionState(regenerateBackupCodesAction, null);

  return (
    <div className="form-stack">
      <form action={action}>
        <input type="hidden" name="csrf" value={csrf} />
        <button type="submit" disabled={pending}>
          <KeyRound size={16} aria-hidden />
          Regenerate backup codes
        </button>
      </form>
      {state?.codes?.length ? (
        <div className="success">
          <strong>Store these backup codes now. They are shown only after regeneration.</strong>
          <div className="form-grid" style={{ marginTop: "0.75rem" }}>
            {state.codes.map((code) => (
              <code key={code}>{code}</code>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
