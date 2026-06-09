import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CreateUserForm } from "@/components/CreateUserForm";
import { requireAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { deleteUserAction } from "./actions";

export const metadata: Metadata = {
  title: "Users"
};

export default async function UsersPage() {
  const admin = await requireAdmin();
  if (!admin) return null;

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
      <div className="content-header">
        <div>
          <h1>Admin users</h1>
          <p className="muted">Create and manage admin accounts that can sign in to this Surls instance.</p>
        </div>
      </div>

      <section className="surface surface-panel">
        <h2>Add user</h2>
        <CreateUserForm csrf={csrf} />
      </section>

      <section className="surface surface-panel">
        <h2>Users</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
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
                  <td>
                    <strong>{user.name || user.email}</strong>
                    <div className="muted small">{user.email}</div>
                    <div className="muted small">Created {formatDateTime(user.createdAt, displayTimeZone)}</div>
                  </td>
                  <td>
                    <div className="row-actions small">
                      <span className={user.totpCredential?.enabled ? "badge" : "badge warning"}>
                        TOTP {user.totpCredential?.enabled ? "on" : "off"}
                      </span>
                      <span className={user._count.passkeys ? "badge" : "badge warning"}>
                        {user._count.passkeys} {user._count.passkeys === 1 ? "passkey" : "passkeys"}
                      </span>
                    </div>
                  </td>
                  <td>{user._count.shortLinks}</td>
                  <td>{user._count.sessions}</td>
                  <td>{user.lastLoginAt ? formatDateTime(user.lastLoginAt, displayTimeZone) : "Never"}</td>
                  <td>
                    {user.id === admin.id ? (
                      <span className="muted small">Current user</span>
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
