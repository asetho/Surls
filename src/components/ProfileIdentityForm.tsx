"use client";

import { useActionState, useEffect } from "react";
import { Save } from "lucide-react";
import { updateProfileAction } from "@/app/admin/profile/actions";
import { dispatchAdminToast } from "@/lib/admin-toast-event";
import { DEFAULT_MOBILE_MENU_SIDE, normalizeMobileMenuSide } from "@/lib/mobile-menu";
import { TimeZoneSelect } from "./TimeZoneSelect";

type ProfileIdentityFormProps = {
  csrf: string;
  siteDefaultTimeZone: string;
  user: {
    displayTimeZone: string | null;
    email: string;
    mobileMenuSide?: string | null;
    name: string | null;
  };
};

export function ProfileIdentityForm({ csrf, siteDefaultTimeZone, user }: ProfileIdentityFormProps) {
  const [state, action, pending] = useActionState(updateProfileAction, null);
  const mobileMenuSide = normalizeMobileMenuSide(user.mobileMenuSide ?? DEFAULT_MOBILE_MENU_SIDE);

  useEffect(() => {
    if (state?.message) dispatchAdminToast("success", state.message);
    if (state?.error) dispatchAdminToast("error", state.error);
  }, [state]);

  return (
    <form className="form-stack" action={action}>
      <input type="hidden" name="csrf" value={csrf} />
      <div className="form-grid">
        <label>
          Display name
          <input name="name" autoComplete="name" defaultValue={user.name ?? ""} />
        </label>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" defaultValue={user.email} required />
        </label>
        <TimeZoneSelect
          className="form-field"
          siteDefaultTimeZone={siteDefaultTimeZone}
          value={user.displayTimeZone}
        />
        <label className="form-field">
          Mobile menu side
          <select name="mobileMenuSide" defaultValue={mobileMenuSide}>
            <option value="right">Right side</option>
            <option value="left">Left side</option>
          </select>
        </label>
      </div>
      <div className="profile-meta-row">
        <span className="muted small">Used for sign-in, passkeys, account activity, and timestamp display.</span>
      </div>
      <button type="submit" disabled={pending}>
        <Save size={16} aria-hidden />
        {pending ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
