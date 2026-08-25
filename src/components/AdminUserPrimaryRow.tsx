"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { updateUserIdentityAction } from "@/app/admin/users/actions";
import { dispatchAdminToast } from "@/lib/admin-toast-event";
import { TimeZoneSelect } from "./TimeZoneSelect";

type UserRole = "ADMIN" | "USER";
type EditableUserField = "displayTimeZone" | "email" | "name" | "role";

const EDITABLE_USER_FIELDS: EditableUserField[] = ["name", "email", "displayTimeZone", "role"];

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

function initialFieldValues(user: AdminUserPrimaryRowProps["user"]): Record<EditableUserField, string> {
  return {
    displayTimeZone: user.displayTimeZone ?? "",
    email: user.email,
    name: user.name ?? "",
    role: user.role
  };
}

type FieldRevertButtonProps = {
  disabled: boolean;
  fieldLabel: string;
  onClick: () => void;
};

function FieldRevertButton({ disabled, fieldLabel, onClick }: FieldRevertButtonProps) {
  return (
    <button
      aria-label={`Revert ${fieldLabel} change`}
      className="admin-user-revert-button"
      disabled={disabled}
      onClick={onClick}
      title={`Revert ${fieldLabel} change`}
      type="button"
    >
      <RotateCcw aria-hidden="true" size={13} strokeWidth={2.4} />
    </button>
  );
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
  const savedFieldValues = initialFieldValues(user);
  const [changedFields, setChangedFields] = useState<EditableUserField[]>([]);
  const [state, action, pending] = useActionState(updateUserIdentityAction, null);
  const dirty = changedFields.length > 0;

  useEffect(() => {
    if (state?.message) dispatchAdminToast("success", state.message);
    if (state?.error) dispatchAdminToast("error", state.error);
  }, [state]);

  function updateDirtyState() {
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    setChangedFields(
      EDITABLE_USER_FIELDS.filter((field) => String(formData.get(field) ?? "") !== savedFieldValues[field])
    );
  }

  function revertField(field: EditableUserField) {
    const control = formRef.current?.elements.namedItem(field);
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
      control.value = savedFieldValues[field];
      setChangedFields((fields) => fields.filter((changedField) => changedField !== field));
    }
  }

  return (
    <tr className="admin-user-primary-row" onChange={updateDirtyState}>
      <td data-label="User">
        <form className="user-identity-form" id={formId} ref={formRef} action={action}>
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="id" value={user.id} />
          {!canEditRole ? <input type="hidden" name="role" value={user.role} /> : null}
          <label className={`admin-user-edit-field${changedFields.includes("name") ? " has-revert" : ""}`}>
            <span className="sr-only">Display name</span>
            <input name="name" autoComplete="off" defaultValue={user.name ?? ""} placeholder="Display name" />
            {changedFields.includes("name") ? (
              <FieldRevertButton
                disabled={pending}
                fieldLabel="display name"
                onClick={() => revertField("name")}
              />
            ) : null}
          </label>
          <label className={`admin-user-edit-field${changedFields.includes("email") ? " has-revert" : ""}`}>
            <span className="sr-only">Email</span>
            <input name="email" type="email" autoComplete="off" defaultValue={user.email} required />
            {changedFields.includes("email") ? (
              <FieldRevertButton disabled={pending} fieldLabel="email" onClick={() => revertField("email")} />
            ) : null}
          </label>
          <span
            className={`admin-user-edit-field admin-user-select-edit-field${changedFields.includes("displayTimeZone") ? " has-revert" : ""}`}
          >
            <TimeZoneSelect
              className="user-timezone-select"
              hideLabel
              label="Display timezone"
              siteDefaultTimeZone={siteDefaultTimeZone}
              value={user.displayTimeZone}
            />
            {changedFields.includes("displayTimeZone") ? (
              <FieldRevertButton
                disabled={pending}
                fieldLabel="display timezone"
                onClick={() => revertField("displayTimeZone")}
              />
            ) : null}
          </span>
          <div className="admin-user-edit-actions" aria-live="polite">
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
          <span
            className={`admin-user-edit-field admin-user-select-edit-field${changedFields.includes("role") ? " has-revert" : ""}`}
          >
            <select className="admin-user-role-select" name="role" defaultValue={user.role} form={formId}>
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
            {changedFields.includes("role") ? (
              <FieldRevertButton disabled={pending} fieldLabel="role" onClick={() => revertField("role")} />
            ) : null}
          </span>
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
