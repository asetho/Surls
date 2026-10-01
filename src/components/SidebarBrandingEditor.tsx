"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { AdminSidebarBrand } from "./AdminSidebarBrand";
import { DEFAULT_SIDEBAR_BRANDING, SIDEBAR_LOGO_MAX_BYTES, SIDEBAR_LOGO_MAX_ENCODED_LENGTH, type SidebarBranding } from "@/lib/sidebar-branding";

export function SidebarBrandingEditor({ value, onChange, csrf, siteName, onBusyChange }: {
  value: SidebarBranding; onChange: (value: SidebarBranding) => void; csrf: string;
  siteName: string; onBusyChange: (busy: boolean) => void;
}) {
  const [mode, setMode] = useState<"lightImage" | "darkImage">("lightImage");
  const [base64, setBase64] = useState("");
  const [showBase64, setShowBase64] = useState(false);
  const [showSizing, setShowSizing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);

  async function loadLogo(image: string | File) {
    setError("");
    if (typeof image !== "string" && image.size > SIDEBAR_LOGO_MAX_BYTES) {
      setError("Logo must be 512 KB or smaller."); return;
    }
    setBusy(true); onBusyChange(true);
    try {
      const form = new FormData();
      form.set("csrf", csrf); form.set("intent", "preview-logo"); form.set("logo", image);
      const response = await fetch("/api/admin/dashboard-theme", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok || typeof result.image !== "string") throw new Error(result.error || "Could not load logo.");
      onChange({ ...value, logo: "custom", [mode]: result.image });
      setBase64("");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not load logo."); }
    finally { setBusy(false); onBusyChange(false); }
  }
  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (file) void loadLogo(file);
  }

  return <details className="sidebar-branding-editor">
    <summary>Sidebar branding</summary>
    <div className="form-stack">
      <p className="muted small">Only changes the admin sidebar and its mobile menu.</p>
      <div className="sidebar-branding-preview"><AdminSidebarBrand value={value} siteName={siteName} /></div>
      <fieldset disabled={busy} className="sidebar-branding-fields form-stack">
        <label>Logo
          <select value={value.logo} onChange={(event) => onChange({ ...value, logo: event.target.value as SidebarBranding["logo"] })}>
            <option value="placeholder">Placeholder icon</option>
            <option value="custom">Custom image</option><option value="none">Text only</option>
          </select>
        </label>
        <label>Text beside logo
          <input value={value.text} maxLength={60} placeholder="e.g. Surls" onChange={(event) => onChange({ ...value, text: event.target.value })} />
        </label>
        <button type="button" className="secondary" aria-expanded={showSizing} aria-controls="sidebar-logo-sizing" onClick={() => setShowSizing(!showSizing)}>Edit height/padding</button>
        {showSizing ? <div id="sidebar-logo-sizing" className="form-stack sidebar-branding-options">
          {value.logo !== "none" ? <label>Logo height: {value.logoHeight} px
            <input type="range" min={20} max={64} step={2} value={value.logoHeight} onChange={(event) => onChange({ ...value, logoHeight: Number(event.target.value) })} />
          </label> : null}
          <label>Horizontal padding: {value.paddingX} px
            <input type="range" min={0} max={24} step={1} value={value.paddingX} onChange={(event) => onChange({ ...value, paddingX: Number(event.target.value) })} />
          </label>
          <label>Vertical padding: {value.paddingY} px
            <input type="range" min={0} max={24} step={1} value={value.paddingY} onChange={(event) => onChange({ ...value, paddingY: Number(event.target.value) })} />
          </label>
        </div> : null}
        {value.logo === "custom" ? <>
          <label>Logo variant
            <select value={mode} onChange={(event) => { setMode(event.target.value as typeof mode); setBase64(""); setError(""); }}>
              <option value="lightImage">Light mode</option><option value="darkImage">Dark mode</option>
            </select>
          </label>
          <p className="muted small">One image works in both modes. Add a second if your sidebar colors need it. SVG, PNG, JPEG, or WebP; up to 512 KB.</p>
          <input ref={uploadRef} type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" hidden onChange={upload} />
          <div className="sidebar-branding-actions">
            <button type="button" className="secondary" onClick={() => uploadRef.current?.click()}>{busy ? "Loading logo…" : "Upload logo"}</button>
            <button type="button" className="secondary" aria-expanded={showBase64} aria-controls="sidebar-logo-base64" onClick={() => setShowBase64(!showBase64)}>Use base64/data</button>
          </div>
          {showBase64 ? <div id="sidebar-logo-base64" className="form-stack sidebar-branding-options">
            <label>Paste base64 / data URL
              <textarea rows={3} maxLength={SIDEBAR_LOGO_MAX_ENCODED_LENGTH} value={base64} onChange={(event) => setBase64(event.target.value)} spellCheck={false} />
            </label>
            <button type="button" className="secondary" disabled={!base64.trim()} onClick={() => void loadLogo(base64)}>Use pasted image</button>
          </div> : null}
          {value[mode] ? <button type="button" className="secondary" onClick={() => onChange({ ...value, [mode]: "" })}>Remove {mode === "lightImage" ? "light" : "dark"} logo</button> : null}
        </> : null}
        <button type="button" className="secondary" onClick={() => onChange({ ...DEFAULT_SIDEBAR_BRANDING })}>Reset sidebar branding</button>
      </fieldset>
      {error ? <p role="alert" className="alert">{error}</p> : null}
    </div>
  </details>;
}
