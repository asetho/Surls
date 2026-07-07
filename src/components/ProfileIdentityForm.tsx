"use client";

import { useActionState, useEffect } from "react";
import { PanelLeftOpen, PanelRightOpen, Save } from "lucide-react";
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
        <fieldset className="profile-mobile-menu-side-field">
          <legend>Mobile menu side</legend>
          <div className="profile-mobile-menu-side-options">
            <label className="profile-mobile-menu-side-option">
              <input
                className="sr-only"
                type="radio"
                name="mobileMenuSide"
                value="left"
                defaultChecked={mobileMenuSide === "left"}
              />
              <span className="profile-mobile-menu-side-option-label">
                <PanelLeftOpen size={16} aria-hidden />
                Left
              </span>
            </label>
            <label className="profile-mobile-menu-side-option">
              <input
                className="sr-only"
                type="radio"
                name="mobileMenuSide"
                value="right"
                defaultChecked={mobileMenuSide === "right"}
              />
              <span className="profile-mobile-menu-side-option-label">
                <PanelRightOpen size={16} aria-hidden />
                Right
              </span>
            </label>
          </div>
        </fieldset>
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
