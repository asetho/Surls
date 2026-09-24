import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { BackupCodesForm } from "@/components/BackupCodesForm";
import { PasskeyManager } from "@/components/PasskeyManager";
import { ProfileIdentityForm } from "@/components/ProfileIdentityForm";
import { RememberedDetails } from "@/components/RememberedDetails";
import { ConfirmButton } from "@/components/ConfirmButton";
import { adminLoginPath } from "@/lib/admin-login-path";
import { getCsrfToken } from "@/lib/csrf";
import { getCurrentSession, isAdminUser } from "@/lib/auth";
import { formatDateTime, resolveDisplayTimeZone } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { sessionClientSummary, sessionLocationLabel } from "@/lib/session-display";
import { getDisplayTimeZone, getSiteName } from "@/lib/settings";
import { getSettings } from "@/lib/settings";
import { configuredExternalProviders, externalProviderConfig, externalProviderKey } from "@/lib/external-auth";
import { getTotpSecret, totpOtpAuthUrl } from "@/lib/totp";
import {
  cancelTotpSetupAction,
  disableTotpAction,
  enableTotpAction,
  logoutOtherSessionsAction,
  revokeSessionAction,
  startTotpAction
} from "./actions";

export const metadata: Metadata = {
  title: "Profile"
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; connected?: string }> }) {
  const profileParams = await searchParams;
  const currentSession = await getCurrentSession();
  if (!currentSession) redirect(adminLoginPath("/admin/profile"));
  const admin = currentSession.user;
  const csrf = getCsrfToken();
  const [credential, backupCount, latestBackupCode, passkeys, sessions, siteName, siteDefaultTimeZone, settings, externalIdentities] = await Promise.all([
    prisma.totpCredential.findUnique({ where: { userId: admin.id } }),
    prisma.backupCode.count({ where: { userId: admin.id, usedAt: null } }),
    prisma.backupCode.findFirst({
      where: { userId: admin.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    }),
    prisma.passkey.findMany({ where: { userId: admin.id }, orderBy: { createdAt: "desc" } }),
    prisma.session.findMany({
      where: { userId: admin.id, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" },
      select: {
        id: true,
        country: true,
        region: true,
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true
      }
    }),
    getSiteName(),
    getDisplayTimeZone(),
    getSettings(),
    prisma.externalIdentity.findMany({ where: { userId: admin.id }, select: { provider: true } })
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
  const sessionItems = sessions.map((session) => ({
    ...session,
    ...sessionClientSummary(session.userAgent),
    current: session.id === currentSession.id,
    location: sessionLocationLabel(session.country, session.region)
  }));

  return (
    <main className="admin-content">
      <div className="content-header content-header-topbar">
        <div>
          <h1>Profile</h1>
          <p className="muted">Manage your account, privacy, and sign-in security.</p>
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
            mobileMenuSide: admin.mobileMenuSide,
            name: admin.name
          }}
        />
      </section>

      <section className="surface surface-panel profile-card">
        <h2>External sign-in</h2>
        {profileParams.error ? <p className="alert">{profileParams.error}</p> : null}
        {profileParams.connected ? <p className="success">External account connected.</p> : null}
        <p className="muted">Connect a provider while signed in. Facebook and X require this step before they can be used for sign-in.</p>
        {configuredExternalProviders().length ? (
          <div className="form-stack">
            {configuredExternalProviders().map((provider) => {
              const linked = externalIdentities.some((identity) => identity.provider === externalProviderKey(provider));
              return (
                <div className="row-actions" key={provider}>
                  <span>{externalProviderConfig(provider)!.label}: {linked ? "Connected" : "Not connected"}</span>
                  {!linked ? <form action={`/api/auth/external/${provider}`} method="post"><input type="hidden" name="csrf" value={csrf} /><button className="secondary" type="submit">Connect</button></form> : null}
                </div>
              );
            })}
          </div>
        ) : <p className="muted">No external providers are configured yet.</p>}
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
              <p className="success profile-status-success">TOTP is enabled for {admin.email}.</p>
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
          <BackupCodesForm
            backupCount={backupCount}
            canDeleteBackupCodes={isAdminUser(admin)}
            csrf={csrf}
            displayTimeZone={displayTimeZone}
            lastGeneratedAt={latestBackupCode?.createdAt.toISOString() ?? null}
          />
        </section>

        {settings.localLoginEnabled ? <section className="profile-security-panel">
          <h3>Passkeys</h3>
          <p className="muted">
            Register a device passkey for passwordless sign-in. Passkey sign-in still requires local user verification
            such as Face ID, Touch ID, Windows Hello, a PIN, or a security key gesture.
          </p>
          <PasskeyManager csrf={csrf} passkeys={passkeyItems} />
        </section> : null}
      </RememberedDetails>

      <RememberedDetails
        className="surface settings-collapse profile-security-collapse"
        summaryClassName="settings-card-header"
        bodyClassName="profile-privacy-body"
        storageKey="surls-profile-privacy-open"
        title="Privacy"
      >
        <section className="profile-privacy-panel">
          <div>
            <h3>Active sessions</h3>
            <p className="muted">
              Review where your account is signed in. Locations are coarse region and country values supplied by the
              trusted proxy; Surls does not store session IP addresses.
            </p>
          </div>

          <div className="profile-session-grid" role="list">
            {sessionItems.map((session) => (
              <article className="profile-session-card" key={session.id} role="listitem">
                <header>
                  <div>
                    <strong>{session.client}</strong>
                    <span className="muted">{session.device}</span>
                  </div>
                  {session.current ? <span className="status-pill status-pill-active">Current session</span> : null}
                </header>
                <dl>
                  <div>
                    <dt>Location</dt>
                    <dd>{session.location}</dd>
                  </div>
                  <div>
                    <dt>Last active</dt>
                    <dd>{formatDateTime(session.lastSeenAt, displayTimeZone)}</dd>
                  </div>
                  <div>
                    <dt>Signed in</dt>
                    <dd>{formatDateTime(session.createdAt, displayTimeZone)}</dd>
                  </div>
                  <div>
                    <dt>Expires</dt>
                    <dd>{formatDateTime(session.expiresAt, displayTimeZone)}</dd>
                  </div>
                </dl>
                {!session.current ? (
                  <form action={revokeSessionAction}>
                    <input type="hidden" name="csrf" value={csrf} />
                    <input type="hidden" name="sessionId" value={session.id} />
                    <ConfirmButton
                      className="danger-outline"
                      type="submit"
                      message={`Log out the ${session.client} session on ${session.device}?`}
                    >
                      Log out this session
                    </ConfirmButton>
                  </form>
                ) : null}
              </article>
            ))}
          </div>

          <form action={logoutOtherSessionsAction}>
            <input type="hidden" name="csrf" value={csrf} />
            <ConfirmButton
              className="danger-outline"
              disabled={sessionItems.length <= 1}
              type="submit"
              message="Log out every other active session? This device will stay signed in."
            >
              Log out all other sessions
            </ConfirmButton>
          </form>
          {sessionItems.length <= 1 ? <p className="muted profile-session-only">This is your only active session.</p> : null}
        </section>
      </RememberedDetails>
    </main>
  );
}
