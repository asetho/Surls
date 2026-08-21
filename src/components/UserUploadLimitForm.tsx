"use client";

import { useActionState, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { updateUserUploadLimitAction } from "@/app/admin/users/actions";
import { dispatchAdminToast } from "@/lib/admin-toast-event";
import type { UserUploadLimitMode } from "@/lib/upload-limits";

export function UserUploadLimitForm({
  csrf,
  initialMegabytes,
  initialMode,
  siteDefaultLabel,
  userId
}: {
  csrf: string;
  initialMegabytes: number | null;
  initialMode: UserUploadLimitMode;
  siteDefaultLabel: string;
  userId: string;
}) {
  const [state, action, pending] = useActionState(updateUserUploadLimitAction, null);
  const [mode, setMode] = useState(initialMode);

  useEffect(() => {
    if (state?.message) dispatchAdminToast("success", state.message);
    if (state?.error) dispatchAdminToast("error", state.error);
  }, [state]);

  return (
    <form className="user-upload-limit-form" action={action}>
      <input type="hidden" name="csrf" value={csrf} />
      <input type="hidden" name="id" value={userId} />
      <select
        aria-label="Upload limit policy"
        name="uploadLimitMode"
        value={mode}
        onChange={(event) => setMode(event.target.value as UserUploadLimitMode)}
      >
        <option value="default">Site default ({siteDefaultLabel})</option>
        <option value="custom">Custom limit</option>
        <option value="unlimited">No limit</option>
      </select>
      <div className="user-upload-limit-value">
        <input
          aria-label="Custom upload limit in megabytes"
          disabled={mode !== "custom"}
          max="1024"
          min="1"
          name="uploadMaxMegabytes"
          type="number"
          defaultValue={initialMegabytes ?? 25}
        />
        <span className="muted small">MB</span>
      </div>
      <button className="secondary" type="submit" disabled={pending} aria-label="Save upload limit">
        <Save size={16} aria-hidden />
        Save
      </button>
    </form>
  );
}
