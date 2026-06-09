import type { Metadata } from "next";
import QRCode from "qrcode";
import { BackupCodesForm } from "@/components/BackupCodesForm";
import { getCsrfToken } from "@/lib/csrf";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteName } from "@/lib/settings";
import { getTotpSecret, totpOtpAuthUrl } from "@/lib/totp";
import { disableTotpAction, enableTotpAction, startTotpAction } from "./actions";

export const metadata: Metadata = {
  title: "Security"
};

export default async function ProfilePage() {
  const admin = await requireAdmin();
  if (!admin) return null;
  const csrf = getCsrfToken();
  const [credential, backupCount, passkeys, siteName] = await Promise.all([
    prisma.totpCredential.findUnique({ where: { userId: admin.id } }),
    prisma.backupCode.count({ where: { userId: admin.id, usedAt: null } }),
    prisma.passkey.findMany({ where: { userId: admin.id }, orderBy: { createdAt: "desc" } }),
    getSiteName()
  ]);

  const pendingSecret = credential && !credential.enabled ? getTotpSecret(credential.secretEncrypted) : null;
  const qr = pendingSecret
    ? await QRCode.toDataURL(totpOtpAuthUrl(admin.email, pendingSecret, siteName), { margin: 1 })
    : null;

  return (
    <main className="admin-content">
      <div className="content-header">
        <div>
          <h1>Admin security</h1>
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
        <BackupCodesForm csrf={csrf} />
      </section>

      <section className="surface" style={{ padding: "1rem" }}>
        <h2>Passkeys</h2>
        <p className="muted">
          The database model is ready for WebAuthn passkeys. Full browser registration and assertion endpoints are listed
          as a recommended follow-up for this initial build.
        </p>
        {passkeys.length ? (
          <ul>
            {passkeys.map((passkey) => (
              <li key={passkey.id}>{passkey.name}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No passkeys registered.</p>
        )}
      </section>
    </main>
  );
}
