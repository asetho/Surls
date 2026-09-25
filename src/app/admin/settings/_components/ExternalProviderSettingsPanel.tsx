"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal, flushSync, useFormStatus } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pencil, Plus, Search, Settings2, Trash2, X } from "lucide-react";
import type { ExternalProvider, ExternalProviderSummary } from "@/lib/external-provider-settings";
import { PROVIDER_LOGOS } from "@/lib/provider-logos";
import {
  disableExternalProviderAction,
  removeExternalProviderAction,
  saveExternalProviderAction,
  setExternalLoginEnabledAction
} from "../external-provider-actions";

const PROVIDER_TYPES = ["oidc", "google", "github", "discord", "microsoft", "facebook", "x"] as const satisfies readonly ExternalProvider[];

const SEARCH_TERMS: Record<ExternalProvider, string> = {
  oidc: "openid connect oidc keycloak sso custom",
  google: "google",
  github: "github",
  discord: "discord",
  microsoft: "microsoft entra azure",
  facebook: "facebook meta",
  x: "x twitter"
};

function ProviderIcon({ provider, logoDataUrl }: { provider: ExternalProvider; logoDataUrl?: string | null }) {
  return <span className="config-provider-icon" data-provider={provider} data-custom-logo={Boolean(logoDataUrl)} aria-hidden="true"><Image className="config-provider-logo" src={logoDataUrl || PROVIDER_LOGOS[provider]} alt="" width={24} height={24} unoptimized /></span>;
}

function ProviderRow({ provider, onEdit, onRemove }: {
  provider: ExternalProviderSummary;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const dismiss = () => { if (menu?.matches(":popover-open")) menu.hidePopover(); };
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [open]);

  function closeMenu() {
    menuRef.current?.hidePopover();
    triggerRef.current?.focus();
  }

  function openMenu(last = false) {
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return;
    menu.showPopover();
    const bounds = trigger.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(bounds.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, bounds.bottom + menu.offsetHeight + 4 <= window.innerHeight ? bounds.bottom + 4 : bounds.top - menu.offsetHeight - 4)}px`;
    const items = menu.querySelectorAll<HTMLButtonElement>("button");
    items[last ? items.length - 1 : 0]?.focus();
  }

  return (
    <div className="config-provider-row-wrapper">
      <button ref={triggerRef} className="config-provider-row" type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId}
        onClick={() => open ? closeMenu() : openMenu()}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          openMenu(event.key === "ArrowUp");
        }}>
        <ProviderIcon provider={provider.provider} logoDataUrl={provider.logoDataUrl} />
        <span className="config-provider-row-label"><strong>{provider.label}</strong><small className="muted">{provider.name} · {provider.enabled ? "enabled" : "disabled"}{provider.source === "environment" ? " · environment" : ""}</small></span>
        <Pencil size={16} aria-hidden="true" />
      </button>
      <div ref={menuRef} id={menuId} className="config-provider-menu" popover="auto" role="menu" aria-label={`Actions for ${provider.label}`}
        onToggle={(event) => setOpen(event.newState === "open")}
        onKeyDown={(event) => {
          if (event.key === "Escape" || event.key === "Tab") {
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); }
            closeMenu();
            return;
          }
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
          const current = items.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 :
            (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          items[next]?.focus();
        }}>
        <button type="button" className="secondary" role="menuitem" tabIndex={-1} onClick={() => { closeMenu(); onEdit(); }}><Pencil size={16} aria-hidden="true" /> Edit</button>
        <button type="button" className="danger-outline" role="menuitem" tabIndex={-1} onClick={() => { closeMenu(); onRemove(); }}><Trash2 size={16} aria-hidden="true" /> Remove</button>
      </div>
    </div>
  );
}

function ProviderRemovalButtons({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus();
  return <div className="row-actions config-provider-remove-actions">
    <button className="secondary" type="button" onClick={onCancel} disabled={pending}>Cancel</button>
    <button className="danger" type="submit" disabled={pending}><Trash2 size={16} aria-hidden="true" /> {pending ? "Removing…" : "Remove provider"}</button>
  </div>;
}

function ProviderEditor({ provider, csrf, titleId, onCancel }: {
  provider: ExternalProviderSummary;
  csrf: string;
  titleId: string;
  onCancel: () => void;
}) {
  const formId = useId();
  return (
    <div className="config-provider-editor-panel">
      <header className="config-provider-editor-header">
        <div className="config-provider-editor-title">
          <ProviderIcon provider={provider.provider} logoDataUrl={provider.logoDataUrl} />
          <div>
            <h2 id={titleId}>{provider.source === "none" ? `Add ${provider.name}` : `Edit ${provider.name}`}</h2>
            <p className="muted small">{provider.source === "environment" ? "Using server environment credentials" : provider.source === "settings" ? "Credentials managed in Settings" : "Enter credentials from the provider console"}</p>
          </div>
        </div>
        <button type="button" className="icon-button" aria-label="Close provider editor" onClick={onCancel}><X size={18} /></button>
      </header>
      <div className="config-provider-editor-content">
      <form id={formId} action={saveExternalProviderAction} className="form-stack">
        <input type="hidden" name="csrf" value={csrf} />
        <input type="hidden" name="provider" value={provider.provider} />
        <input type="hidden" name="key" value={provider.key} />
        <label>Button label<input name="label" defaultValue={provider.label} required maxLength={80} autoComplete="off" /></label>
        {provider.provider === "oidc" ? (
          <label>Issuer URL<input name="issuer" type="url" defaultValue={provider.issuer} placeholder="https://auth.example.com/realms/example" required maxLength={512} autoComplete="off" /></label>
        ) : null}
        {provider.provider === "microsoft" ? (
          <label>Tenant ID or domain<input name="tenantId" defaultValue={provider.tenantId} required maxLength={253} autoComplete="off" /></label>
        ) : null}
        <label>Client ID<input name="clientId" defaultValue={provider.clientId} required maxLength={512} autoComplete="off" /></label>
        <label>Client secret<input name="clientSecret" type="password" placeholder={provider.hasSecret ? "Saved — leave blank to keep" : "Enter client secret"} maxLength={4096} autoComplete="new-password" /></label>
        {provider.provider === "oidc" ? <div className="config-provider-logo-field">
          <div className="config-provider-logo-preview"><ProviderIcon provider={provider.provider} logoDataUrl={provider.logoDataUrl} /><span>{provider.logoDataUrl ? "Custom logo" : "Default provider logo"}</span></div>
          <label>Upload logo<input name="logoFile" type="file" accept="image/svg+xml,image/png,image/webp,image/jpeg" /></label>
          <label>Or paste base64 image code<textarea name="logoBase64" rows={3} maxLength={350000} placeholder="data:image/svg+xml;base64,… or raw base64" spellCheck={false} /></label>
          <p className="muted small">SVG, PNG, WebP, or JPEG, up to 256 KB. Leave both blank to keep the current logo.</p>
          {provider.logoDataUrl ? <label className="checkbox-label"><input type="checkbox" name="removeLogo" /> Remove custom logo and use default</label> : null}
        </div> : null}
        <div className="form-field"><strong>Callback URL</strong><code className="config-callback-url">{provider.callbackUrl}</code></div>
        <p className="muted small">Register this exact callback URL with {provider.name}. Saved secrets are encrypted and never shown again.</p>
      </form>
      {provider.enabled ? (
        <form action={disableExternalProviderAction}>
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="provider" value={provider.provider} />
          <input type="hidden" name="key" value={provider.key} />
          <button className="button secondary" type="submit">Disable {provider.name}</button>
        </form>
      ) : null}
      </div>
      <footer className="config-provider-editor-footer">
        <button className="button secondary" type="button" onClick={onCancel}>Close</button>
        <button type="submit" form={formId}>Save and enable {provider.name}</button>
      </footer>
    </div>
  );
}

export function ExternalProviderSettingsPanel({ providers, csrf, externalLoginEnabled, localLoginEnabled }: {
  providers: ExternalProviderSummary[];
  csrf: string;
  externalLoginEnabled: boolean;
  localLoginEnabled: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ExternalProviderSummary | null>(null);
  const [removingProvider, setRemovingProvider] = useState<ExternalProviderSummary | null>(null);
  const [search, setSearch] = useState("");
  const drawerRef = useRef<HTMLDialogElement>(null);
  const pickerRef = useRef<HTMLDialogElement>(null);
  const editorRef = useRef<HTMLDialogElement>(null);
  const removeRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const requestedOpen = searchParams.get("externalSignIn") === "open";
  const titleId = useId();
  const pickerTitleId = useId();
  const editorTitleId = useId();
  const removeTitleId = useId();
  const removeDescriptionId = useId();

  const configured = providers.filter((provider) => provider.source !== "none");
  const matches = PROVIDER_TYPES.filter((provider) => `${providers.find((item) => item.key === provider)?.name} ${SEARCH_TERMS[provider]}`.toLowerCase().includes(search.trim().toLowerCase()));

  function openPicker() {
    setSearch("");
    pickerRef.current?.showModal();
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  const openDrawer = useCallback(() => {
    flushSync(() => setMounted(true));
    if (!drawerRef.current?.open) drawerRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (!requestedOpen) return;
    const timer = window.setTimeout(() => {
      editorRef.current?.close();
      removeRef.current?.close();
      openDrawer();
      const url = new URL(window.location.href);
      url.searchParams.delete("externalSignIn");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [openDrawer, requestedOpen]);

  function chooseProvider(provider: ExternalProvider) {
    const template = providers.find((item) => item.key === provider);
    if (!template) return;
    const key = `${provider}--${crypto.randomUUID()}`;
    pickerRef.current?.close();
    openEditor({ ...template, key, label: template.name, logoDataUrl: null, clientId: "", issuer: "", tenantId: "",
      source: "none", enabled: false, hasSecret: false, needsSecret: false,
      callbackUrl: template.callbackUrl.replace(`/${provider}/callback`, `/${key}/callback`) });
  }

  function openEditor(provider: ExternalProviderSummary) {
    flushSync(() => setSelectedProvider(provider));
    editorRef.current?.showModal();
  }

  function closeEditor() {
    editorRef.current?.close();
    setSelectedProvider(null);
  }

  function confirmRemoval(provider: ExternalProviderSummary) {
    flushSync(() => setRemovingProvider(provider));
    removeRef.current?.showModal();
  }

  function closeDrawer() {
    closeEditor();
    removeRef.current?.close();
    pickerRef.current?.close();
    drawerRef.current?.close();
  }

  return (
    <>
      <button className="icon-button config-provider-gear" type="button" aria-label="Manage external sign-in providers" title="Manage external sign-in providers" onClick={openDrawer}>
        <Settings2 size={20} aria-hidden="true" />
      </button>
      {mounted ? createPortal(
        <>
          <dialog ref={drawerRef} className="config-provider-drawer" aria-labelledby={titleId} onClick={(event) => { if (event.target === drawerRef.current) closeDrawer(); }} onClose={() => setSelectedProvider(null)}>
            <div className="config-provider-drawer-panel">
              <header className="config-provider-drawer-header">
                <div><h2 id={titleId}>External sign-in</h2><p className="muted">Manage OAuth2 and OpenID Connect providers for this site.</p></div>
                <button className="icon-button" type="button" aria-label="Close provider settings" onClick={closeDrawer}><X size={20} /></button>
              </header>
              <div className="config-provider-drawer-content">
                <section className="config-provider-auth-card" aria-labelledby="config-provider-list-heading">
                  <div className="config-provider-section-header"><h3 id="config-provider-list-heading">OAuth2</h3><span className={externalLoginEnabled ? "status-pill status-pill-active" : "status-pill"}>{externalLoginEnabled ? "Enabled" : "Disabled"}</span></div>
                  <div className="config-provider-auth-content">
                    <div className="config-provider-enable-row">
                      <form action={setExternalLoginEnabledAction}>
                        <input type="hidden" name="csrf" value={csrf} />
                        <input type="hidden" name="enabled" value={String(!externalLoginEnabled)} />
                        <button className="config-provider-switch" type="submit" role="switch" aria-checked={externalLoginEnabled} aria-label="External sign-in" disabled={externalLoginEnabled && !localLoginEnabled} title={externalLoginEnabled && !localLoginEnabled ? "Enable password and passkey sign-in before turning this off" : undefined}>
                          <span />
                        </button>
                      </form>
                      <span>Enable external sign-in</span>
                    </div>
                    <p className="muted small config-provider-switch-help">{externalLoginEnabled ? "Enabled providers appear on sign-in pages." : "All external sign-in buttons are hidden and new sign-in attempts are blocked."}</p>
                    {externalLoginEnabled && !localLoginEnabled ? <p className="muted small config-provider-switch-help">Password and passkey sign-in must be enabled before external sign-in can be turned off.</p> : null}
                    <div className="config-provider-list">
                      {configured.length === 0 ? <p className="muted config-provider-empty">No providers added yet.</p> : null}
                      {configured.map((provider) => (
                        <ProviderRow key={provider.key} provider={provider} onEdit={() => openEditor(provider)} onRemove={() => confirmRemoval(provider)} />
                      ))}
                      <button className="button secondary config-provider-add" type="button" onClick={openPicker}><Plus size={18} aria-hidden="true" /> Add provider</button>
                    </div>
                  </div>
                </section>
                <p className="muted small">Changing an OIDC issuer or Microsoft tenant changes its identity namespace. Connect your admin account under the new provider before disabling the current sign-in method.</p>
                <Link className="button secondary" href="https://github.com/asetho/Surls/blob/main/docs/external-sign-in.md" target="_blank" rel="noreferrer">Open setup guide</Link>
              </div>
              <footer className="config-provider-drawer-footer"><button className="button secondary" type="button" onClick={closeDrawer}>Close</button></footer>
            </div>
          </dialog>
          {selectedProvider ? <dialog ref={editorRef} className="config-provider-editor-dialog" aria-labelledby={editorTitleId} onClose={() => setSelectedProvider(null)}>
            <ProviderEditor key={selectedProvider.key} provider={selectedProvider} csrf={csrf} titleId={editorTitleId} onCancel={closeEditor} />
          </dialog> : null}
          {removingProvider ? <dialog ref={removeRef} className="modal-dialog config-provider-remove-dialog" aria-labelledby={removeTitleId} aria-describedby={removeDescriptionId} onClose={() => setRemovingProvider(null)}>
            <div className="modal-panel">
              <div className="modal-header"><h2 id={removeTitleId}>Remove {removingProvider.label}?</h2></div>
              <div id={removeDescriptionId} className="config-provider-remove-description">
                <p>This removes the provider’s saved settings and sign-in button. Anyone using this provider will need another sign-in method.</p>
                <p className="muted">Existing Surls accounts and links are kept.</p>
              </div>
              <form action={removeExternalProviderAction}>
                <input type="hidden" name="csrf" value={csrf} />
                <input type="hidden" name="provider" value={removingProvider.provider} />
                <input type="hidden" name="key" value={removingProvider.key} />
                <ProviderRemovalButtons onCancel={() => removeRef.current?.close()} />
              </form>
            </div>
          </dialog> : null}
          <dialog ref={pickerRef} className="config-provider-picker" aria-labelledby={pickerTitleId} onClick={(event) => { if (event.target === pickerRef.current) pickerRef.current?.close(); }}>
            <div className="config-provider-picker-panel">
              <header className="modal-header"><h2 id={pickerTitleId}>Select OAuth2 provider</h2><button className="icon-button" type="button" aria-label="Close provider picker" onClick={() => pickerRef.current?.close()}><X size={20} /></button></header>
              <label className="config-provider-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search providers</span><input ref={searchRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search providers…" /></label>
              <div className="config-provider-picker-grid">
                {matches.map((provider) => (
                  <button className="config-provider-option" type="button" key={provider} onClick={() => chooseProvider(provider)}>
                    <ProviderIcon provider={provider} /><span><strong>{providers.find((item) => item.key === provider)?.name}</strong><small className="muted">{provider === "oidc" ? "Keycloak or custom OIDC" : provider === "google" || provider === "microsoft" ? "OpenID Connect" : "OAuth 2.0"}</small></span>
                  </button>
                ))}
              </div>
              {matches.length === 0 ? <p className="muted">No supported providers match your search.</p> : null}
              <footer><button className="button secondary" type="button" onClick={() => pickerRef.current?.close()}>Close</button></footer>
            </div>
          </dialog>
        </>, document.querySelector(".admin-shell") ?? document.body) : null}
    </>
  );
}
