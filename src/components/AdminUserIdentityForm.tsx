"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateUserIdentityAction } from "@/app/admin/users/actions";

type AdminUserIdentityFormProps = {
  csrf: string;
  user: {
    email: string;
    id: string;
    name: string | null;
  };
};

export function AdminUserIdentityForm({ csrf, user }: AdminUserIdentityFormProps) {
  const [state, action, pending] = useActionState(updateUserIdentityAction, null);

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
      <button className="secondary icon-button" type="submit" disabled={pending}>
        <Save size={16} aria-hidden />
        {pending ? "Saving..." : "Save"}
      </button>
      {state?.message ? <div className="success small">{state.message}</div> : null}
      {state?.error ? <div className="alert small">{state.error}</div> : null}
    </form>
  );
}
