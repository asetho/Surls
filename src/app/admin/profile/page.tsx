import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { KeyRound, Link2, Shield, ShieldCheck } from "lucide-react";
import { BackupCodesForm } from "@/components/BackupCodesForm";
import { DisableTotpForm } from "@/components/DisableTotpForm";
import { ExternalConnectForm } from "@/components/ExternalConnectForm";
import { PasskeyManager } from "@/components/PasskeyManager";
import { ProfileIdentityForm } from "@/components/ProfileIdentityForm";
import { RememberedDetails } from "@/components/RememberedDetails";
import { TotpEnrollmentForm } from "@/components/TotpEnrollmentForm";
import { TotpSetupStartForm } from "@/components/TotpSetupStartForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { adminLoginPath } from "@/lib/admin-login-path";
import { getCsrfToken } from "@/lib/csrf";
import { getCurrentSession, isAdminUser } from "@/lib/auth";
import { formatDateTime, resolveDisplayTimeZone } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { profileEmailAvailable } from "@/lib/profile-email";
import { decodeProfileVerification, PROFILE_VERIFICATION_COOKIE } from "@/lib/profile-verification";
import { sessionClientSummary, sessionLocationLabel } from "@/lib/session-display";
import { getDisplayTimeZone, getSiteName } from "@/lib/settings";
import { getSettings } from "@/lib/settings";
import { externalProviderKey, getConfiguredExternalProviders } from "@/lib/external-provider-settings";
import { getTotpSecret, totpOtpAuthUrl } from "@/lib/totp";
import { totpSetupSecretForSession, TOTP_SETUP_COOKIE } from "@/lib/totp-enrollment";
import { decodeTotpSetupProof, TOTP_SETUP_PROOF_COOKIE } from "@/lib/totp-setup-proof";
import {
  cancelTotpSetupAction,
  logoutOtherSessionsAction,
  revokeSessionAction
} from "./actions";

export const metadata: Metadata = {
  title: "Profile"
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; connected?: string; totpVerified?: string }> }) {
  const profileParams = await searchParams;
  const currentSession = await getCurrentSession();
  if (!currentSession) redirect(adminLoginPath("/admin/profile"));
  const admin = currentSession.user;
  const csrf = getCsrfToken();
  const jar = await cookies();
  const verification = decodeProfileVerification(jar.get(PROFILE_VERIFICATION_COOKIE)?.value);
  const providerVerified = verification?.userId === admin.id && verification.sessionId === currentSession.id;
  const [credential, backupCount, latestBackupCode, passkeys, sessions, siteName, siteDefaultTimeZone, settings, externalIdentities, externalProviders, emailCodeAvailable] = await Promise.all([
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
        city: true,
        localNetwork: true,
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true
      }
    }),
    getSiteName(),
    getDisplayTimeZone(),
    getSettings(),
    prisma.externalIdentity.findMany({ where: { userId: admin.id }, select: { provider: true, createdAt: true } }),
    getConfiguredExternalProviders(),
    profileEmailAvailable()
  ]);
  const displayTimeZone = resolveDisplayTimeZone(admin.displayTimeZone, siteDefaultTimeZone);
  const totpEstablishedAt = credential?.enabled ? credential.enabledAt ?? credential.createdAt : null;
  const backupCodeSessionFresh = Boolean(totpEstablishedAt && currentSession.createdAt >= totpEstablishedAt);
  const totpSetupProof = decodeTotpSetupProof(jar.get(TOTP_SETUP_PROOF_COOKIE)?.value);
  const providerProofReady = Boolean(!credential?.enabled && totpSetupProof?.userId === admin.id && totpSetupProof.sessionId === currentSession.id);

  const pendingEncrypted = !credential?.enabled
    ? totpSetupSecretForSession(jar.get(TOTP_SETUP_COOKIE)?.value, admin.id, currentSession.id) : null;
  const pendingSecret = pendingEncrypted ? getTotpSecret(pendingEncrypted) : null;
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
    location: sessionLocationLabel(session.country, session.region, session.localNetwork, session.city)
  }));
  const emailVerificationProviders = settings.externalLoginEnabled ? externalProviders
    .filter((config) => ["oidc", "google", "microsoft"].includes(config.provider) &&
      externalIdentities.some((identity) => identity.provider === externalProviderKey(config) && identity.createdAt <= currentSession.createdAt))
    .map((config) => ({ key: config.key, label: config.label })) : [];
  const connectVerificationProviders = settings.externalLoginEnabled ? externalProviders
    .filter((config) => (!credential?.enabled || ["oidc", "google", "microsoft"].includes(config.provider)) &&
      externalIdentities.some((identity) => identity.provider === externalProviderKey(config) && identity.createdAt <= currentSession.createdAt))
    .map((config) => ({ key: config.key, label: config.label })) : [];
  const totpVerificationProviders = settings.externalLoginEnabled ? externalProviders
    .filter((config) => externalIdentities.some((identity) => identity.provider === externalProviderKey(config) && identity.createdAt <= currentSession.createdAt))
    .map((config) => ({ key: config.key, label: config.label })) : [];

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
          emailCodeAvailable={emailCodeAvailable}
          emailVerificationProviders={emailVerificationProviders}
          pendingEmail={providerVerified ? verification?.pendingEmail ?? null : null}
          providerVerified={providerVerified}
          siteDefaultTimeZone={siteDefaultTimeZone}
          totpEnabled={Boolean(credential?.enabled)}
          user={{
            displayTimeZone: admin.displayTimeZone,
            email: admin.email,
            mobileMenuSide: admin.mobileMenuSide,
            name: admin.name
          }}
        />
      </section>

      <RememberedDetails
        className="surface settings-collapse profile-security-collapse"
        summaryClassName="settings-card-header"
        bodyClassName="settings-collapse-body profile-external-body"
        defaultOpen={Boolean(profileParams.error || profileParams.connected)}
        storageKey="surls-profile-external-open"
        status={settings.externalLoginEnabled && externalProviders.some((config) =>
          externalIdentities.some((identity) => identity.provider === externalProviderKey(config))) ? (
          <span className="profile-status-icon is-enabled" role="img" aria-label="External sign-in connected" title="External sign-in connected">
            <Link2 size={16} aria-hidden />
          </span>
        ) : null}
        title="External sign-in"
      >
        {profileParams.error ? <p className="alert">{profileParams.error}</p> : null}
        {profileParams.connected ? <p className="success">External account connected.</p> : null}
        <p className="muted">{settings.externalLoginEnabled ? "Connect a provider while signed in. Facebook and X require this step before they can be used for sign-in." : "External sign-in is currently disabled by the site administrator."}</p>
        {externalProviders.length ? (
          <div className="form-stack">
            {externalProviders.map((config) => {
              const linked = externalIdentities.some((identity) => identity.provider === externalProviderKey(config));
              return (
                <div className="row-actions" key={config.key}>
                  <span>{config.label}: {linked ? "Connected" : "Not connected"}</span>
                  {!linked && settings.externalLoginEnabled ? <ExternalConnectForm
                    csrf={csrf}
                    provider={{ key: config.key, label: config.label }}
                    currentEmail={admin.email}
                    totpEnabled={Boolean(credential?.enabled)}
                    emailCodeAvailable={emailCodeAvailable}
                    verificationProviders={connectVerificationProviders}
                  /> : null}
                </div>
              );
            })}
          </div>
        ) : <p className="muted">No external providers are configured yet.</p>}
      </RememberedDetails>

      <RememberedDetails
        className="surface settings-collapse profile-security-collapse"
        summaryClassName="settings-card-header"
        bodyClassName="profile-security-body"
        defaultOpen={Boolean(profileParams.totpVerified)}
        storageKey="surls-profile-security-open"
        status={<>
          <span className={`profile-status-icon${credential?.enabled ? " is-enabled" : ""}`} role="img" aria-label={credential?.enabled ? "TOTP enabled" : "TOTP not enabled"} title={credential?.enabled ? "TOTP enabled" : "TOTP not enabled"}>
            {credential?.enabled ? <ShieldCheck size={16} aria-hidden /> : <Shield size={16} aria-hidden />}
          </span>
          <span className={`profile-status-icon${passkeys.length && settings.localLoginEnabled ? " is-enabled" : ""}`} role="img" aria-label={passkeys.length ? `${passkeys.length} passkeys registered${settings.localLoginEnabled ? "" : ", sign-in disabled"}` : "No passkeys registered"} title={passkeys.length ? `${passkeys.length} passkeys registered${settings.localLoginEnabled ? "" : ", sign-in disabled"}` : "No passkeys registered"}>
            <KeyRound size={16} aria-hidden />
          </span>
        </>}
        title="Security"
      >
        <section className="profile-security-panel">
          <div className="profile-security-section-heading">
            <h3>TOTP 2FA</h3>
            {credential?.enabled ? <span className="status-pill status-pill-active">Enabled</span> : null}
          </div>
          {credential?.enabled ? (
            <div className="form-stack">
              <DisableTotpForm csrf={csrf} />
            </div>
          ) : (
            <div className="form-stack">
              {!pendingSecret ? (
                <TotpSetupStartForm csrf={csrf} currentEmail={admin.email}
                  emailCodeAvailable={emailCodeAvailable} localLoginEnabled={settings.localLoginEnabled}
                  providerProofReady={providerProofReady} verificationProviders={totpVerificationProviders} />
              ) : (
                <div className="totp-setup-panel">
                  <p className="muted">Scan the QR code or enter the manual setup key. Verify a current code, then save and confirm your backup codes to enable TOTP.</p>
                  <div className="qr-box totp-qr-box">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr ?? ""} alt="TOTP setup QR code" width={180} height={180} />
                  </div>
                  <code className="totp-manual-key">{pendingSecret}</code>
                  <div className="totp-setup-actions">
                    <TotpEnrollmentForm csrf={csrf} />
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
          {credential?.enabled && backupCount === 0 ? (
            <p className="alert" role="alert">You have no backup codes. Generate and save a set now so you can recover access if you lose your authenticator.</p>
          ) : null}
          <p className="muted">
            You currently have {backupCount} unused backup {backupCount === 1 ? "code" : "codes"}. Codes are stored only
            as hashes and are consumed after one successful use.
          </p>
          {credential?.enabled ? (backupCodeSessionFresh ? <BackupCodesForm
            backupCount={backupCount}
            canDeleteBackupCodes={isAdminUser(admin)}
            csrf={csrf}
            displayTimeZone={displayTimeZone}
            lastGeneratedAt={latestBackupCode?.createdAt.toISOString() ?? null}
          /> : <p className="muted small">Sign out and sign in again with your new authenticator before managing backup codes. The codes from setup remain active.</p>)
            : <p className="muted small">Verify your authenticator above to generate backup codes during TOTP setup.</p>}
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
              Review where your account is signed in. Locations show approximate cities, states or regions, and countries when available.
              Private and Tailscale connections show as Local network. Surls does not store session IP addresses.
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
