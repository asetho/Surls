"use client";

import { useActionState, useEffect } from "react";
import { Save } from "lucide-react";
import { updateUserIdentityAction } from "@/app/admin/users/actions";
import { dispatchAdminToast } from "@/lib/admin-toast-event";
import { TimeZoneSelect } from "./TimeZoneSelect";

type AdminUserIdentityFormProps = {
  csrf: string;
  siteDefaultTimeZone: string;
  user: {
    displayTimeZone: string | null;
    email: string;
    id: string;
    name: string | null;
  };
};

export function AdminUserIdentityForm({ csrf, siteDefaultTimeZone, user }: AdminUserIdentityFormProps) {
  const [state, action, pending] = useActionState(updateUserIdentityAction, null);

  useEffect(() => {
    if (state?.message) dispatchAdminToast("success", state.message);
    if (state?.error) dispatchAdminToast("error", state.error);
  }, [state]);

  return (
    <form className="user-identity-form" action={action}>
      <input type="hidden" name="csrf" value={csrf} />
      <input type="hidden" name="id" value={user.id} />
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
      <button className="secondary icon-button" type="submit" disabled={pending}>
        <Save size={16} aria-hidden />
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
