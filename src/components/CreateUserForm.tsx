"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { createUserAction } from "@/app/admin/users/actions";

export function CreateUserForm({ csrf }: { csrf: string }) {
  const [state, action, pending] = useActionState(createUserAction, null);

  return (
    <form className="form-stack" action={action}>
      <input type="hidden" name="csrf" value={csrf} />
      <div className="form-grid">
        <label>
          Email
          <input name="email" type="email" autoComplete="off" required />
        </label>
        <label>
          Display name
          <input name="name" autoComplete="off" />
        </label>
      </div>
      <label>
        Temporary password
        <input name="password" type="password" autoComplete="new-password" minLength={12} required />
      </label>
      <button type="submit" disabled={pending}>
        <UserPlus size={16} aria-hidden />
        {pending ? "Creating..." : "Create user"}
      </button>
      {state?.message ? <div className="success">{state.message}</div> : null}
      {state?.error ? <div className="alert">{state.error}</div> : null}
    </form>
  );
}
