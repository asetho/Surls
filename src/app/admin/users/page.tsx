import type { Metadata } from "next";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { AdminUserIdentityForm } from "@/components/AdminUserIdentityForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CreateUserForm } from "@/components/CreateUserForm";
import { UserUploadLimitForm } from "@/components/UserUploadLimitForm";
import { adminLoginPath } from "@/lib/admin-login-path";
import { requireSiteAdmin } from "@/lib/auth";
import { getCsrfToken } from "@/lib/csrf";
import { formatDateTime, resolveDisplayTimeZone } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getDisplayTimeZone, getSiteUploadMaxBytes } from "@/lib/settings";
import { uploadBytesToMegabytes, userUploadLimitMode } from "@/lib/upload-limits";
import { uploadMaxBytesLabel } from "@/lib/uploads";
import { deleteUserAction, updateUserRoleAction } from "./actions";

export const metadata: Metadata = {
  title: "Users"
};

export default async function UsersPage() {
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminLoginPath("/admin/users"));

  const csrf = getCsrfToken();
  const now = new Date();
  const [users, siteDefaultTimeZone, siteUploadMaxBytes] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: {
            passkeys: true,
            sessions: {
              where: {
                expiresAt: { gt: now }
              }
            },
            shortLinks: true
          }
        },
        totpCredential: true
      }
    }),
    getDisplayTimeZone(),
    getSiteUploadMaxBytes()
  ]);
  const displayTimeZone = resolveDisplayTimeZone(admin.displayTimeZone, siteDefaultTimeZone);

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
          <table className="data-table data-table-dense data-table-users responsive-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Security</th>
                <th>Links</th>
                <th>Sessions</th>
                <th>Last login</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td data-label="User">
                    <AdminUserIdentityForm
                      csrf={csrf}
                      siteDefaultTimeZone={siteDefaultTimeZone}
                      user={{
                        displayTimeZone: user.displayTimeZone,
                        email: user.email,
                        id: user.id,
                        name: user.name
                      }}
                    />
                    <div className="muted small">Created {formatDateTime(user.createdAt, displayTimeZone)}</div>
                    <details className="admin-user-management settings-collapse">
                      <summary>Upload limit &amp; actions</summary>
                      <div className="settings-collapse-body admin-user-management-body">
                        <section>
                          <h3>Upload limit</h3>
                          <UserUploadLimitForm
                            csrf={csrf}
                            initialMegabytes={
                              uploadBytesToMegabytes(user.uploadMaxBytes) ?? uploadBytesToMegabytes(siteUploadMaxBytes)
                            }
                            initialMode={userUploadLimitMode(user)}
                            siteDefaultLabel={uploadMaxBytesLabel(siteUploadMaxBytes)}
                            userId={user.id}
                          />
                        </section>
                        <section>
                          <h3>Actions</h3>
                          {user.id === admin.id ? (
                            <span className="muted small">No actions available for the current admin.</span>
                          ) : (
                            <form action={deleteUserAction}>
                              <input type="hidden" name="csrf" value={csrf} />
                              <input type="hidden" name="id" value={user.id} />
                              <ConfirmButton className="danger icon-button" type="submit" message={`Delete ${user.email}?`}>
                                <Trash2 size={16} aria-hidden />
                                Delete user
                              </ConfirmButton>
                            </form>
                          )}
                        </section>
                      </div>
                    </details>
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
                  <td className="data-table-numeric" data-label="Links">{user._count.shortLinks}</td>
                  <td className="data-table-numeric" data-label="Sessions">{user._count.sessions}</td>
                  <td className="data-table-time" data-label="Last login">{user.lastLoginAt ? formatDateTime(user.lastLoginAt, displayTimeZone) : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
