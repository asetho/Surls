"use client";

import { useActionState, useEffect } from "react";
import { UserPlus } from "lucide-react";
import { createUserAction } from "@/app/admin/users/actions";
import { dispatchAdminToast } from "@/lib/admin-toast-event";

export function CreateUserForm({ csrf }: { csrf: string }) {
  const [state, action, pending] = useActionState(createUserAction, null);

  useEffect(() => {
    if (state?.message) dispatchAdminToast("success", state.message);
    if (state?.error) dispatchAdminToast("error", state.error);
  }, [state]);

  return (
    <form className="form-stack create-user-form" action={action}>
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
        Role
        <select name="role" defaultValue="USER">
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
        </select>
      </label>
      <label>
        Temporary password (optional for external sign-in)
        <input name="password" type="password" autoComplete="new-password" minLength={12} />
      </label>
      <button type="submit" disabled={pending}>
        <UserPlus size={16} aria-hidden />
        {pending ? "Creating..." : "Create user"}
      </button>
    </form>
  );
}
