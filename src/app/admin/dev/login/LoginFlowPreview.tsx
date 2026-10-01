"use client";

import Image from "next/image";
import { useState, type KeyboardEvent } from "react";
import { LoginPageShell } from "@/components/LoginPageShell";
import { TurnstilePreviewGate } from "@/components/TurnstilePreviewGate";
import type { CustomHtmlPage } from "@/lib/settings";
import { LoginPreviewSurface } from "../../../login-dev/LoginPreviewSurface";

type FlowStage = "login" | "external" | "passkey" | "totp" | "success";
type FlowOption = "password" | "passkey" | "external" | "turnstile" | "totp" | "providerMfa";
type FlowOptions = Record<FlowOption, boolean>;
type PreviewProvider = { label: string; logo: string };

export function LoginFlowPreview({
  customPage,
  localLoginEnabled,
  nonce,
  providers,
  siteName
}: {
  customPage: CustomHtmlPage | null;
  localLoginEnabled: boolean;
  nonce?: string;
  providers: PreviewProvider[];
  siteName: string;
}) {
  const [options, setOptions] = useState<FlowOptions>({
    password: localLoginEnabled,
    passkey: localLoginEnabled,
    external: providers.length > 0,
    turnstile: true,
    totp: true,
    providerMfa: true
  });
  const [stage, setStage] = useState<FlowStage>("login");
  const [revision, setRevision] = useState(0);
  const [securityCheckComplete, setSecurityCheckComplete] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [backupMode, setBackupMode] = useState(false);
  const [error, setError] = useState("");
  const [providerName, setProviderName] = useState("");

  const availableProviders = providers.length > 0 ? providers : [{ label: "Example provider", logo: "" }];

  function reset() {
    setStage("login");
    setRevision((value) => value + 1);
    setSecurityCheckComplete(false);
    setEmail("");
    setPassword("");
    setCode("");
    setBackupMode(false);
    setError("");
    setProviderName("");
  }

  function setOption(option: FlowOption, checked: boolean) {
    setOptions((current) => ({ ...current, [option]: checked }));
    reset();
  }

  function continuePassword() {
    if (!email.trim() || !password) {
      setError("Enter sample values for email and password to continue.");
      return;
    }
    setError("");
    setPassword("");
    setStage(options.totp ? "totp" : "success");
  }

  function continueCode() {
    if (backupMode ? !code.trim() : !/^\d{6}$/.test(code)) {
      setError(backupMode ? "Enter a sample backup code to continue." : "Enter any six digits to continue.");
      return;
    }
    setError("");
    setCode("");
    setStage("success");
  }

  function enterToContinue(event: KeyboardEvent<HTMLInputElement>, action: () => void) {
    if (event.key === "Enter") {
      event.preventDefault();
      action();
    }
  }

  const title = stage === "totp" ? "Enter your 2FA code" :
    stage === "external" ? `Continue with ${providerName}` :
    stage === "passkey" ? "Sign in with passkey" :
    stage === "success" ? "Signed in" : `${siteName} login`;
  const tagline = stage === "totp" ? (email ? `Finish signing in to ${siteName} as\n${email}.` : `Finish signing in to ${siteName}.`) :
    stage === "success" ? "You have completed the simulated sign-in flow." :
    "Sign in to manage private links, redirects, and click statistics.";
  const hideTagline = stage === "login" && options.turnstile && !securityCheckComplete;
  const embedded = Boolean(customPage);
  const signInMethods = (
    <>
      {options.password ? (
        <>
          <label data-surls-auth-field>Email<input type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.currentTarget.value)} onKeyDown={(event) => enterToContinue(event, continuePassword)} placeholder="you@example.com" data-surls-auth-input /></label>
          <label data-surls-auth-field>Password<input type="password" autoComplete="off" value={password} onChange={(event) => setPassword(event.currentTarget.value)} onKeyDown={(event) => enterToContinue(event, continuePassword)} placeholder="Sample password" data-surls-auth-input /></label>
          <button type="button" onClick={continuePassword} data-surls-auth-submit>Log in</button>
        </>
      ) : null}
      {options.password && options.passkey ? <div className="login-divider" data-surls-auth-divider><span>or</span></div> : null}
      {options.passkey ? <button className="secondary" type="button" onClick={() => setStage("passkey")} data-surls-auth-secondary>Sign in with passkey</button> : null}
      {options.external ? (
        <div className="form-stack" aria-label="External sign-in options">
          {availableProviders.map((provider) => (
            <button className="secondary external-login-button" key={provider.label} type="button" onClick={() => { setProviderName(provider.label); setStage("external"); }} data-surls-auth-secondary>
              {provider.logo ? <Image className="external-login-logo" src={provider.logo} alt="" width={20} height={20} unoptimized /> : null}
              Continue with {provider.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );

  return (
    <div className="login-flow-preview" data-surls-turnstile-pending={hideTagline || undefined}>
      <section className="login-flow-controls surface" aria-label="Login simulation settings">
        <div className="login-flow-controls-heading">
          <div>
            <h2>Test a login scenario</h2>
            <p className="muted small">hmserv development preview only. Use sample values; no credentials or codes are checked or sent.</p>
          </div>
          <button className="secondary" type="button" onClick={reset}>Start over</button>
        </div>
        <div className="login-flow-switches">
          <label><input type="checkbox" checked={options.password} onChange={(event) => setOption("password", event.currentTarget.checked)} /> Password sign-in</label>
          <label><input type="checkbox" checked={options.passkey} onChange={(event) => setOption("passkey", event.currentTarget.checked)} /> Passkey sign-in</label>
          <label><input type="checkbox" checked={options.external} onChange={(event) => setOption("external", event.currentTarget.checked)} /> External provider</label>
          <label><input type="checkbox" checked={options.turnstile} onChange={(event) => setOption("turnstile", event.currentTarget.checked)} /> Simulated Turnstile</label>
          <label><input type="checkbox" checked={options.totp} onChange={(event) => setOption("totp", event.currentTarget.checked)} /> Account TOTP</label>
          <label><input type="checkbox" checked={options.providerMfa} onChange={(event) => setOption("providerMfa", event.currentTarget.checked)} /> Provider confirms MFA</label>
        </div>
        <p className="muted small login-flow-note">Provider MFA skips the local TOTP step, as it does when the provider reports MFA in a real sign-in.</p>
      </section>
      <LoginPreviewSurface>
        <LoginPageShell customPage={customPage} nonce={nonce} tagline={hideTagline ? "" : tagline} title={title}>
          <div className={`${embedded ? "surls-auth-form-embedded" : "surface login-card"} surls-auth-form form-stack`} data-surls-auth-form data-surls-login-flow>
            {!embedded ? (
              <div data-surls-auth-intro>
                <h1>{title}</h1>
                {!hideTagline ? <p className="muted">{tagline}</p> : null}
              </div>
            ) : null}
            {error ? <div className="alert" role="alert">{error}</div> : null}
            {stage === "login" ? (
              <>
                {(options.password || options.passkey || options.external) ? (
                  options.turnstile ? <TurnstilePreviewGate key={revision} onComplete={() => setSecurityCheckComplete(true)}>{signInMethods}</TurnstilePreviewGate> : <div className="form-stack">{signInMethods}</div>
                ) : null}
                {!options.password && !options.passkey && !options.external ? <p className="alert">No sign-in methods are enabled in this scenario.</p> : null}
              </>
            ) : null}
            {stage === "external" ? (
              <>
                <p className="muted">A real sign-in would open {providerName}. Complete this simulated provider step to see what happens when you return.</p>
                <button type="button" onClick={() => setStage(options.totp && !options.providerMfa ? "totp" : "success")}>Complete provider sign-in</button>
                <button className="secondary" type="button" onClick={reset}>Back to sign-in</button>
              </>
            ) : null}
            {stage === "passkey" ? (
              <>
                <p className="muted">A real sign-in would ask your device to verify your passkey.</p>
                <button type="button" onClick={() => setStage("success")}>Complete passkey check</button>
                <button className="secondary" type="button" onClick={reset}>Back to sign-in</button>
              </>
            ) : null}
            {stage === "totp" ? (
              <>
                <p className="muted">Enter any sample {backupMode ? "backup code" : "six-digit code"}. No code is verified.</p>
                <label data-surls-auth-field>{backupMode ? "Backup code" : "Authenticator code"}
                  <input type="text" inputMode={backupMode ? "text" : "numeric"} autoComplete="off" value={code} onChange={(event) => setCode(backupMode ? event.currentTarget.value : event.currentTarget.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(event) => enterToContinue(event, continueCode)} placeholder={backupMode ? "XXXXX-XXXXX" : "000000"} data-surls-auth-input />
                </label>
                <button type="button" onClick={continueCode} data-surls-auth-submit>Continue</button>
                <button className="secondary" type="button" onClick={() => { setBackupMode(!backupMode); setCode(""); setError(""); }} data-surls-auth-secondary>{backupMode ? "Use an authenticator code" : "Use a backup code instead"}</button>
                <button className="secondary" type="button" onClick={reset}>Back to sign-in</button>
              </>
            ) : null}
            {stage === "success" ? (
              <>
                <p className="login-flow-success" role="status">Sign-in complete</p>
                <p className="muted">This is the end of the preview. Your real session was not changed.</p>
                <button type="button" onClick={reset}>Reset login flow</button>
              </>
            ) : null}
          </div>
        </LoginPageShell>
      </LoginPreviewSurface>
    </div>
  );
}
