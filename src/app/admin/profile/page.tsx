import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { BackupCodesForm } from "@/components/BackupCodesForm";
import { PasskeyManager } from "@/components/PasskeyManager";
import { getCsrfToken } from "@/lib/csrf";
import { isAdminUser, requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getSetting, getSiteName } from "@/lib/settings";
import { getTotpSecret, totpOtpAuthUrl } from "@/lib/totp";
import { disableTotpAction, enableTotpAction, startTotpAction } from "./actions";

export const metadata: Metadata = {
  title: "Security"
};

export default async function ProfilePage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin");
  const csrf = getCsrfToken();
  const [credential, backupCount, passkeys, siteName, displayTimeZone] = await Promise.all([
    prisma.totpCredential.findUnique({ where: { userId: admin.id } }),
    prisma.backupCode.count({ where: { userId: admin.id, usedAt: null } }),
    prisma.passkey.findMany({ where: { userId: admin.id }, orderBy: { createdAt: "desc" } }),
    getSiteName(),
    getSetting("displayTimeZone")
  ]);

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
      <div className="content-header">
        <div>
          <h1>User security</h1>
          <p className="muted">Manage TOTP 2FA, one-time backup codes, and optional passkey records.</p>
        </div>
      </div>

      <section className="surface" style={{ padding: "1rem" }}>
        <h2>TOTP 2FA</h2>
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
              <>
                <p className="muted">Scan the QR code or enter the manual setup key, then verify a current code.</p>
                <div className="qr-box">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr ?? ""} alt="TOTP setup QR code" width={180} height={180} />
                </div>
                <code>{pendingSecret}</code>
                <form className="form-stack" action={enableTotpAction}>
                  <input type="hidden" name="csrf" value={csrf} />
                  <label>
                    Verification code
                    <input name="code" inputMode="numeric" autoComplete="one-time-code" required />
                  </label>
                  <button type="submit">Verify and enable TOTP</button>
                </form>
              </>
            )}
          </div>
        )}
      </section>

      <section className="surface" style={{ padding: "1rem" }}>
        <h2>Backup codes</h2>
        <p className="muted">
          You currently have {backupCount} unused backup {backupCount === 1 ? "code" : "codes"}. Codes are stored only
          as hashes and are consumed after one successful use.
        </p>
        <BackupCodesForm backupCount={backupCount} canDeleteBackupCodes={isAdminUser(admin)} csrf={csrf} />
      </section>

      <section className="surface" style={{ padding: "1rem" }}>
        <h2>Passkeys</h2>
        <p className="muted">
          Register a device passkey for passwordless sign-in. Passkey sign-in still requires local user verification such
          as Face ID, Touch ID, Windows Hello, a PIN, or a security key gesture.
        </p>
        <PasskeyManager csrf={csrf} passkeys={passkeyItems} />
      </section>
    </main>
  );
}
