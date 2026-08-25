import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { Fragment } from "react";
import { AdminUserPrimaryRow } from "@/components/AdminUserPrimaryRow";
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
import { deleteUserAction } from "./actions";

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
                <th>Links</th>
                <th>Sessions</th>
                <th>Last login</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <Fragment key={user.id}>
                  <AdminUserPrimaryRow
                    key={`${user.id}-${user.updatedAt.getTime()}`}
                    canEditRole={user.id !== admin.id}
                    csrf={csrf}
                    lastLoginLabel={user.lastLoginAt ? formatDateTime(user.lastLoginAt, displayTimeZone) : "Never"}
                    linkCount={user._count.shortLinks}
                    sessionCount={user._count.sessions}
                    siteDefaultTimeZone={siteDefaultTimeZone}
                    user={{
                      displayTimeZone: user.displayTimeZone,
                      email: user.email,
                      id: user.id,
                      name: user.name,
                      role: user.role
                    }}
                  />
                  <tr className="admin-user-management-row">
                    <td colSpan={5}>
                      <details className="admin-user-management settings-collapse">
                        <summary>
                          <span className="admin-user-management-summary-label">Security, upload limit &amp; actions</span>
                          <span className="admin-user-created-at">
                            Created {formatDateTime(user.createdAt, displayTimeZone)}
                          </span>
                          <span className="admin-user-security-indicators">
                            {user.totpCredential?.enabled ? (
                              <span className="admin-user-security-indicator" title="TOTP enabled">
                                <ShieldCheck size={14} aria-hidden />
                                <span className="sr-only">TOTP enabled</span>
                              </span>
                            ) : null}
                            {user._count.passkeys > 0 ? (
                              <span
                                className="admin-user-security-indicator"
                                title={`${user._count.passkeys} ${user._count.passkeys === 1 ? "passkey" : "passkeys"} registered`}
                              >
                                <KeyRound size={14} aria-hidden />
                                <span className="sr-only">
                                  {user._count.passkeys} {user._count.passkeys === 1 ? "passkey" : "passkeys"} registered
                                </span>
                              </span>
                            ) : null}
                          </span>
                        </summary>
                        <div className="settings-collapse-body admin-user-management-body">
                          <section>
                            <h3>Security</h3>
                            <div className="row-actions small">
                              <span className={user.totpCredential?.enabled ? "badge" : "badge warning"}>
                                TOTP {user.totpCredential?.enabled ? "on" : "off"}
                              </span>
                              <span className={user._count.passkeys ? "badge" : "badge warning"}>
                                {user._count.passkeys} {user._count.passkeys === 1 ? "passkey" : "passkeys"}
                              </span>
                            </div>
                          </section>
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
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
