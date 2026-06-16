"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateProfileAction } from "@/app/admin/profile/actions";

type ProfileIdentityFormProps = {
  csrf: string;
  user: {
    email: string;
    name: string | null;
  };
};

export function ProfileIdentityForm({ csrf, user }: ProfileIdentityFormProps) {
  const [state, action, pending] = useActionState(updateProfileAction, null);

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
      </div>
      <div className="profile-meta-row">
        <span className="muted small">Used for sign-in, passkeys, and account activity.</span>
      </div>
      <button type="submit" disabled={pending}>
        <Save size={16} aria-hidden />
        {pending ? "Saving..." : "Save profile"}
      </button>
      {state?.message ? <div className="success">{state.message}</div> : null}
      {state?.error ? <div className="alert">{state.error}</div> : null}
    </form>
  );
}
