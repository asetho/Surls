"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { updateUserIdentityAction } from "@/app/admin/users/actions";
import { dispatchAdminToast } from "@/lib/admin-toast-event";
import { TimeZoneSelect } from "./TimeZoneSelect";

type UserRole = "ADMIN" | "USER";

type AdminUserPrimaryRowProps = {
  canEditRole: boolean;
  csrf: string;
  lastLoginLabel: string;
  linkCount: number;
  sessionCount: number;
  siteDefaultTimeZone: string;
  user: {
    displayTimeZone: string | null;
    email: string;
    id: string;
    name: string | null;
    role: UserRole;
  };
};

function formFingerprint(form: HTMLFormElement) {
  const formData = new FormData(form);
  return ["name", "email", "displayTimeZone", "role"]
    .map((name) => String(formData.get(name) ?? ""))
    .join("\u0000");
}

function initialFingerprint(user: AdminUserPrimaryRowProps["user"]) {
  return [user.name ?? "", user.email, user.displayTimeZone ?? "", user.role].join("\u0000");
}

export function AdminUserPrimaryRow({
  canEditRole,
  csrf,
  lastLoginLabel,
  linkCount,
  sessionCount,
  siteDefaultTimeZone,
  user
}: AdminUserPrimaryRowProps) {
  const formId = `admin-user-${user.id}-form`;
  const formRef = useRef<HTMLFormElement>(null);
  const userFingerprint = initialFingerprint(user);
  const [currentFingerprint, setCurrentFingerprint] = useState(userFingerprint);
  const [state, action, pending] = useActionState(updateUserIdentityAction, null);
  const dirty = currentFingerprint !== userFingerprint;

  useEffect(() => {
    if (state?.message) dispatchAdminToast("success", state.message);
    if (state?.error) dispatchAdminToast("error", state.error);
  }, [state]);

  function updateDirtyState() {
    const form = formRef.current;
    if (form) setCurrentFingerprint(formFingerprint(form));
  }

  function revertChanges() {
    formRef.current?.reset();
    setCurrentFingerprint(userFingerprint);
  }

  return (
    <tr className="admin-user-primary-row" onChange={updateDirtyState}>
      <td data-label="User">
        <form className="user-identity-form" id={formId} ref={formRef} action={action}>
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="id" value={user.id} />
          {!canEditRole ? <input type="hidden" name="role" value={user.role} /> : null}
          <label>
            <span className="sr-only">Display name</span>
            <input name="name" autoComplete="off" defaultValue={user.name ?? ""} placeholder="Display name" />
          </label>
          <label>
            <span className="sr-only">Email</span>
            <input name="email" type="email" autoComplete="off" defaultValue={user.email} required />
          </label>
          <TimeZoneSelect
            className="user-timezone-select"
            hideLabel
            label="Display timezone"
            siteDefaultTimeZone={siteDefaultTimeZone}
            value={user.displayTimeZone}
          />
          <div className="admin-user-edit-actions" aria-live="polite">
            {dirty ? (
              <button
                aria-label="Revert user changes"
                className="secondary icon-button icon-only-action"
                disabled={pending}
                onClick={revertChanges}
                title="Revert user changes"
                type="button"
              >
                <RotateCcw size={16} aria-hidden />
              </button>
            ) : null}
            <button
              aria-label={pending ? "Saving user changes" : "Save user changes"}
              className="secondary icon-button icon-only-action"
              disabled={!dirty || pending}
              title={pending ? "Saving user changes" : "Save user changes"}
              type="submit"
            >
              <Save size={16} aria-hidden />
            </button>
          </div>
        </form>
      </td>
      <td data-label="Role">
        {canEditRole ? (
          <select className="admin-user-role-select" name="role" defaultValue={user.role} form={formId}>
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </select>
        ) : (
          <span className="admin-user-role-static">
            <span className="badge">Admin</span>
          </span>
        )}
      </td>
      <td className="data-table-numeric" data-label="Links">{linkCount}</td>
      <td className="data-table-numeric" data-label="Sessions">{sessionCount}</td>
      <td className="data-table-time" data-label="Last login">{lastLoginLabel}</td>
    </tr>
  );
}
