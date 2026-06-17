import type { Metadata } from "next";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { AdminUserIdentityForm } from "@/components/AdminUserIdentityForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CreateUserForm } from "@/components/CreateUserForm";
import { adminLoginPath } from "@/lib/admin-login-path";
import { requireSiteAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { deleteUserAction, updateUserRoleAction } from "./actions";

export const metadata: Metadata = {
  title: "Users"
};

export default async function UsersPage() {
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminLoginPath("/admin/users"));

  const csrf = getCsrfToken();
  const [users, displayTimeZone] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: {
            passkeys: true,
            sessions: true,
            shortLinks: true
          }
        },
        totpCredential: true
      }
    }),
    getSetting("displayTimeZone")
  ]);

  return (
    <main className="admin-content">
      <div className="content-header content-header-topbar">
        <div>
          <h1>Admin users</h1>
          <p className="muted">Create users and admins that can sign in to this Surls instance.</p>
        </div>
      </div>

      <section className="surface surface-panel">
        <h2>Add user</h2>
        <CreateUserForm csrf={csrf} />
      </section>

      <section className="surface surface-panel">
        <h2>Users</h2>
        <div className="table-wrap">
          <table className="responsive-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Security</th>
                <th>Links</th>
                <th>Sessions</th>
                <th>Last login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td data-label="User">
                    <AdminUserIdentityForm
                      csrf={csrf}
                      user={{
                        email: user.email,
                        id: user.id,
                        name: user.name
                      }}
                    />
                    <div className="muted small">Created {formatDateTime(user.createdAt, displayTimeZone)}</div>
                  </td>
                  <td data-label="Role">
                    {user.id === admin.id ? (
                      <span className="badge">Admin</span>
                    ) : (
                      <form className="role-form" action={updateUserRoleAction}>
                        <input type="hidden" name="csrf" value={csrf} />
                        <input type="hidden" name="id" value={user.id} />
                        <select name="role" defaultValue={user.role}>
                          <option value={UserRole.USER}>User</option>
                          <option value={UserRole.ADMIN}>Admin</option>
                        </select>
                        <button className="secondary" type="submit">Save</button>
                      </form>
                    )}
                  </td>
                  <td data-label="Security">
                    <div className="row-actions small">
                      <span className={user.totpCredential?.enabled ? "badge" : "badge warning"}>
                        TOTP {user.totpCredential?.enabled ? "on" : "off"}
                      </span>
                      <span className={user._count.passkeys ? "badge" : "badge warning"}>
                        {user._count.passkeys} {user._count.passkeys === 1 ? "passkey" : "passkeys"}
                      </span>
                    </div>
                  </td>
                  <td data-label="Links">{user._count.shortLinks}</td>
                  <td data-label="Sessions">{user._count.sessions}</td>
                  <td data-label="Last login">{user.lastLoginAt ? formatDateTime(user.lastLoginAt, displayTimeZone) : "Never"}</td>
                  <td data-label="Actions">
                    {user.id === admin.id ? (
                      <span className="muted small">Current admin</span>
                    ) : (
                      <form action={deleteUserAction}>
                        <input type="hidden" name="csrf" value={csrf} />
                        <input type="hidden" name="id" value={user.id} />
                        <ConfirmButton className="danger icon-button" type="submit" message={`Delete ${user.email}?`}>
                          <Trash2 size={16} aria-hidden />
                          Delete
                        </ConfirmButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
