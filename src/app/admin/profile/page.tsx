import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { BackupCodesForm } from "@/components/BackupCodesForm";
import { PasskeyManager } from "@/components/PasskeyManager";
import { ProfileIdentityForm } from "@/components/ProfileIdentityForm";
import { RememberedDetails } from "@/components/RememberedDetails";
import { adminLoginPath } from "@/lib/admin-login-path";
import { getCsrfToken } from "@/lib/csrf";
import { isAdminUser, requireAdmin } from "@/lib/auth";
import { formatDateTime, resolveDisplayTimeZone } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getDisplayTimeZone, getSiteName } from "@/lib/settings";
import { getTotpSecret, totpOtpAuthUrl } from "@/lib/totp";
import { cancelTotpSetupAction, disableTotpAction, enableTotpAction, startTotpAction } from "./actions";

export const metadata: Metadata = {
  title: "Profile"
};

export default async function ProfilePage() {
  const admin = await requireAdmin();
  if (!admin) redirect(adminLoginPath("/admin/profile"));
  const csrf = getCsrfToken();
  const [credential, backupCount, passkeys, siteName, siteDefaultTimeZone] = await Promise.all([
    prisma.totpCredential.findUnique({ where: { userId: admin.id } }),
    prisma.backupCode.count({ where: { userId: admin.id, usedAt: null } }),
    prisma.passkey.findMany({ where: { userId: admin.id }, orderBy: { createdAt: "desc" } }),
    getSiteName(),
    getDisplayTimeZone()
  ]);
  const displayTimeZone = resolveDisplayTimeZone(admin.displayTimeZone, siteDefaultTimeZone);

  const pendingSecret = credential && !credential.enabled ? getTotpSecret(credential.secretEncrypted) : null;
  const qr = pendingSecret
    ? await QRCode.toDataURL(totpOtpAuthUrl(admin.email, pendingSecret, siteName), { margin: 1 })
    : null;
  const passkeyItems = passkeys.map((passkey) => ({
    id: passkey.id,
    name: passkey.name,
    backedUp: passkey.backedUp,
    createdAt: formatDateTime(passkey.createdAt, displayTimeZone),
    lastUsedAt: passkey.lastUsedAt ? formatDateTime(passkey.lastUsedAt, displayTimeZone) : null
  }));

  return (
    <main className="admin-content">
      <div className="content-header content-header-topbar">
        <div>
          <h1>Profile</h1>
          <p className="muted">Manage your name, email, TOTP 2FA, backup codes, and passkeys.</p>
        </div>
      </div>

      <section className="surface surface-panel profile-card">
        <h2>Account information</h2>
        <ProfileIdentityForm
          csrf={csrf}
          siteDefaultTimeZone={siteDefaultTimeZone}
          user={{
            displayTimeZone: admin.displayTimeZone,
            email: admin.email,
            name: admin.name
          }}
        />
      </section>

      <RememberedDetails
        className="surface settings-collapse profile-security-collapse"
        summaryClassName="settings-card-header"
        bodyClassName="profile-security-body"
        storageKey="surls-profile-security-open"
        title="Security"
      >
        <section className="profile-security-panel">
          <h3>TOTP 2FA</h3>
          {credential?.enabled ? (
            <div className="form-stack">
              <p className="success">TOTP is enabled for {admin.email}.</p>
              <form action={disableTotpAction}>
                <input type="hidden" name="csrf" value={csrf} />
                <button className="danger" type="submit">Disable TOTP</button>
              </form>
            </div>
          ) : (
            <div className="form-stack">
              {!pendingSecret ? (
                <form action={startTotpAction}>
                  <input type="hidden" name="csrf" value={csrf} />
                  <button type="submit">Start TOTP setup</button>
                </form>
              ) : (
                <div className="totp-setup-panel">
                  <p className="muted">Scan the QR code or enter the manual setup key, then verify a current code.</p>
                  <div className="qr-box totp-qr-box">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr ?? ""} alt="TOTP setup QR code" width={180} height={180} />
                  </div>
                  <code className="totp-manual-key">{pendingSecret}</code>
                  <div className="totp-setup-actions">
                    <form className="form-stack totp-verify-form" action={enableTotpAction}>
                      <input type="hidden" name="csrf" value={csrf} />
                      <label className="totp-verification-field">
                        Verification code
                        <input name="code" inputMode="numeric" autoComplete="one-time-code" required />
                      </label>
                      <button type="submit">Verify and enable TOTP</button>
                    </form>
                    <form className="totp-cancel-form" action={cancelTotpSetupAction}>
                      <input type="hidden" name="csrf" value={csrf} />
                      <button className="secondary" type="submit">Cancel setup</button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="profile-security-panel">
          <h3>Backup codes</h3>
          <p className="muted">
            You currently have {backupCount} unused backup {backupCount === 1 ? "code" : "codes"}. Codes are stored only
            as hashes and are consumed after one successful use.
          </p>
          <BackupCodesForm backupCount={backupCount} canDeleteBackupCodes={isAdminUser(admin)} csrf={csrf} />
        </section>

        <section className="profile-security-panel">
          <h3>Passkeys</h3>
          <p className="muted">
            Register a device passkey for passwordless sign-in. Passkey sign-in still requires local user verification
            such as Face ID, Touch ID, Windows Hello, a PIN, or a security key gesture.
          </p>
          <PasskeyManager csrf={csrf} passkeys={passkeyItems} />
        </section>
      </RememberedDetails>
    </main>
  );
}
