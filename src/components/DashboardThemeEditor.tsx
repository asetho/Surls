"use client";

import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { AlertTriangle, CheckCircle2, Info, RotateCcw, Search, X } from "lucide-react";
import {
  DASHBOARD_THEME_FIELD_SECTIONS,
  DASHBOARD_THEME_FIELDS,
  DASHBOARD_THEME_MODES,
  DASHBOARD_THEME_TOKEN_REGISTRY,
  dashboardThemeFieldName,
  dashboardThemePaletteCssVariables,
  type DashboardTheme,
  type DashboardThemeKey,
  type DashboardThemeMode,
  type DashboardThemePalette
} from "@/lib/dashboard-theme";

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
type DashboardThemeSectionKey = (typeof DASHBOARD_THEME_FIELD_SECTIONS)[number]["key"];

function currentDocumentThemeMode(): DashboardThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function expandHexColor(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!HEX_COLOR_RE.test(trimmed)) return null;
  if (trimmed.length === 4) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return trimmed;
}

function previewPalette(values: DashboardThemePalette, savedPalette: DashboardThemePalette) {
  return Object.fromEntries(
    DASHBOARD_THEME_FIELDS.map((field) => [field.key, expandHexColor(values[field.key]) ?? savedPalette[field.key]])
  ) as DashboardThemePalette;
}

function DashboardThemeColorField({
  fieldKey,
  label,
  mode,
  name,
  onChange,
  savedValue,
  value
}: {
  fieldKey: DashboardThemeKey;
  label: string;
  mode: DashboardThemeMode;
  name: string;
  onChange: (mode: DashboardThemeMode, key: DashboardThemeKey, value: string) => void;
  savedValue: string;
  value: string;
}) {
  const pickerColor = expandHexColor(value) ?? savedValue;
  const comparableValue = expandHexColor(value) ?? value.trim().toLowerCase();
  const hasChanged = comparableValue !== savedValue.toLowerCase();

  return (
    <span className="dashboard-theme-color-row">
      <span className="dashboard-theme-hex-wrap">
        <input
          aria-label={`${label} HEX color`}
          autoCapitalize="none"
          autoComplete="off"
          className={`dashboard-theme-hex-input${hasChanged ? " has-reset" : ""}`}
          name={name}
          pattern="#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})"
          placeholder="#087e8b"
          required
          spellCheck={false}
          title="Use HEX format, for example #087e8b."
          type="text"
          value={value}
          onBlur={() => {
            const normalized = expandHexColor(value);
            if (normalized) onChange(mode, fieldKey, normalized);
          }}
          onChange={(event) => onChange(mode, fieldKey, event.currentTarget.value)}
        />
        {hasChanged ? (
          <button
            aria-label={`Reset ${label} to saved color`}
            className="dashboard-theme-reset-color"
            title="Reset to saved color"
            type="button"
            onClick={() => onChange(mode, fieldKey, savedValue)}
          >
            <RotateCcw aria-hidden="true" size={13} strokeWidth={2.4} />
          </button>
        ) : null}
      </span>
      <input
        aria-label={`${label} color picker`}
        className="dashboard-theme-color-swatch"
        type="color"
        value={pickerColor}
        onChange={(event) => onChange(mode, fieldKey, event.currentTarget.value.toLowerCase())}
      />
    </span>
  );
}

function ThemePreviewCharts() {
  return (
    <div className="dashboard-theme-preview-chart-stack" aria-hidden="true">
      <div className="dashboard-theme-preview-stat-tabs">
        <span className="is-active">Historical clicks</span>
        <span>Location</span>
        <span>Sources</span>
      </div>
      <div className="dashboard-theme-preview-chart-grid">
        <div className="dashboard-theme-preview-chart-card">
          <span>Line</span>
          <div className="dashboard-theme-preview-chart dashboard-theme-preview-line-chart">
            <svg viewBox="0 0 220 72">
              <path className="dashboard-theme-preview-chart-area" d="M8 58 C42 58 42 24 72 37 C98 48 98 13 126 28 C154 44 155 18 184 22 C202 25 205 44 212 36 L212 64 L8 64 Z" />
              <path className="dashboard-theme-preview-chart-line" d="M8 58 C42 58 42 24 72 37 C98 48 98 13 126 28 C154 44 155 18 184 22 C202 25 205 44 212 36" />
              <circle cx="126" cy="28" r="4" />
            </svg>
          </div>
        </div>
        <div className="dashboard-theme-preview-chart-card">
          <span>Pie</span>
          <div className="dashboard-theme-preview-pie-chart" />
        </div>
        <div className="dashboard-theme-preview-chart-card">
          <span>World map</span>
          <svg className="dashboard-theme-preview-map" viewBox="0 0 220 104">
            <rect x="0" y="0" width="220" height="104" rx="8" />
            <path className="bucket-2" d="M28 33 51 25 73 34 69 51 47 57 28 48Z" />
            <path className="bucket-4" d="M82 42 101 35 119 48 111 69 91 69Z" />
            <path className="bucket-1" d="M121 24 152 19 170 31 159 47 132 44Z" />
            <path className="bucket-5" d="M151 51 183 47 196 65 176 82 151 72Z" />
            <path className="empty" d="M49 64 67 64 72 82 55 88 43 77Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function ThemeModePreview({ label, styles }: { label: string; styles: CSSProperties }) {
  return (
    <div className="dashboard-theme-preview" style={styles} aria-hidden="true">
      <div className="dashboard-theme-preview-sidebar">
        <span>Navigation</span>
        <strong>Dashboard</strong>
        <span>Links</span>
      </div>
      <div className="dashboard-theme-preview-main">
        <div className="dashboard-theme-preview-topbar">Admin toolbar</div>
        <div className="dashboard-theme-preview-panel">
          <strong>{label} preview</strong>
          <span>Common dashboard states update live as you edit the colors.</span>
          <a className="dashboard-theme-preview-link" href="#" tabIndex={-1}>
            Destination link
          </a>
          <ThemePreviewCharts />
          <div className="dashboard-theme-preview-pills">
            <span className="dashboard-theme-preview-pill">Default pill</span>
            <span className="dashboard-theme-preview-pill dashboard-theme-preview-pill-active">Active pill</span>
            <span className="badge warning">Disabled</span>
            <span className="dashboard-theme-preview-short-url-pill">qr-demo</span>
          </div>
          <div className="dashboard-theme-toast-preview-grid dashboard-theme-preview-toast-row">
            <div className="dashboard-theme-toast-preview dashboard-theme-toast-preview-success">
              <CheckCircle2 size={16} aria-hidden />
              <span>Saved.</span>
              <X size={14} aria-hidden />
            </div>
            <div className="dashboard-theme-toast-preview dashboard-theme-toast-preview-error">
              <AlertTriangle size={16} aria-hidden />
              <span>Error.</span>
              <X size={14} aria-hidden />
            </div>
            <div className="dashboard-theme-toast-preview dashboard-theme-toast-preview-info">
              <Info size={16} aria-hidden />
              <span>Notice.</span>
              <X size={14} aria-hidden />
            </div>
          </div>
          <div className="dashboard-theme-preview-actions">
            <button type="button" tabIndex={-1}>Primary action</button>
            <button className="secondary" type="button" tabIndex={-1}>Secondary</button>
            <button className="danger" type="button" tabIndex={-1}>Archive</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardThemeEditor({
  activeMode: controlledActiveMode,
  draftTheme: controlledDraftTheme,
  initialMode,
  onActiveModeChange,
  onDraftThemeChange,
  onTestToast,
  showModePreviews = true,
  theme,
  variant = "panel"
}: {
  activeMode?: DashboardThemeMode;
  draftTheme?: DashboardTheme;
  initialMode?: DashboardThemeMode;
  onActiveModeChange?: (mode: DashboardThemeMode) => void;
  onDraftThemeChange?: (theme: DashboardTheme) => void;
  onTestToast?: (type: "error" | "info" | "success") => void;
  showModePreviews?: boolean;
  theme: DashboardTheme;
  variant?: "drawer" | "panel";
}) {
  const [uncontrolledDraftTheme, setUncontrolledDraftTheme] = useState<DashboardTheme>(theme);
  const [uncontrolledActiveMode, setUncontrolledActiveMode] = useState<DashboardThemeMode>(
    () => initialMode ?? currentDocumentThemeMode()
  );
  const [fieldFilter, setFieldFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState<DashboardThemeSectionKey | "all">("all");
  const draftTheme = controlledDraftTheme ?? uncontrolledDraftTheme;
  const isControlled = controlledDraftTheme !== undefined;
  const activeMode = controlledActiveMode ?? uncontrolledActiveMode;
  const tokenRegistryByKey = useMemo(
    () => new Map(DASHBOARD_THEME_TOKEN_REGISTRY.map((token) => [token.key, token])),
    []
  );
  const visibleFieldSections = useMemo(() => {
    const query = fieldFilter.trim().toLowerCase();
    return DASHBOARD_THEME_FIELD_SECTIONS
      .filter((section) => sectionFilter === "all" || section.key === sectionFilter)
      .map((section) => ({
        ...section,
        fields: section.fields.filter((field) => {
          if (!query) return true;
          const token = tokenRegistryByKey.get(field.key);
          return [
            field.key,
            field.label,
            field.description,
            token?.category,
            token?.subcategory,
            token?.cssCustomProperty
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
        })
      }))
      .filter((section) => section.fields.length > 0);
  }, [fieldFilter, sectionFilter, tokenRegistryByKey]);

  function setNextDraftTheme(nextTheme: DashboardTheme) {
    if (isControlled) {
      onDraftThemeChange?.(nextTheme);
      return;
    }

    setUncontrolledDraftTheme(nextTheme);
    onDraftThemeChange?.(nextTheme);
  }

  function updateColor(mode: DashboardThemeMode, key: DashboardThemeKey, value: string) {
    setNextDraftTheme({
      ...draftTheme,
      [mode]: {
        ...draftTheme[mode],
        [key]: value
      }
    });
  }

  function activateMode(mode: DashboardThemeMode) {
    if (controlledActiveMode === undefined) setUncontrolledActiveMode(mode);
    onActiveModeChange?.(mode);
  }

  function handleModeTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") {
      return;
    }

    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? DASHBOARD_THEME_MODES.length - 1
          : event.key === "ArrowRight"
            ? (index + 1) % DASHBOARD_THEME_MODES.length
            : (index - 1 + DASHBOARD_THEME_MODES.length) % DASHBOARD_THEME_MODES.length;
    activateMode(DASHBOARD_THEME_MODES[nextIndex].key);
  }

  const previewStyles = useMemo(
    () =>
      Object.fromEntries(
        DASHBOARD_THEME_MODES.map((mode) => [
          mode.key,
          dashboardThemePaletteCssVariables(previewPalette(draftTheme[mode.key], theme[mode.key])) as CSSProperties
        ])
      ) as Record<DashboardThemeMode, CSSProperties>,
    [draftTheme, theme]
  );

  return (
    <div className={`dashboard-theme-mode-grid dashboard-theme-mode-grid-${variant}`}>
      <div className="dashboard-theme-mode-tabs" role="tablist" aria-label="Theme mode">
        {DASHBOARD_THEME_MODES.map((mode, index) => {
          const selected = activeMode === mode.key;
          return (
            <button
              id={`dashboard-theme-${mode.key}-tab`}
              aria-controls={`dashboard-theme-${mode.key}-panel`}
              aria-selected={selected}
              className="dashboard-theme-mode-tab"
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
              key={mode.key}
              onClick={() => activateMode(mode.key)}
              onKeyDown={(event) => handleModeTabKeyDown(event, index)}
            >
              {mode.label}
            </button>
          );
        })}
      </div>

      <div className="dashboard-theme-editor-toolbar" aria-label="Theme token filters">
        <label className="dashboard-theme-filter">
          <Search size={15} aria-hidden />
          <span className="sr-only">Filter theme tokens</span>
          <input
            type="search"
            value={fieldFilter}
            placeholder="Filter tokens"
            onChange={(event) => setFieldFilter(event.currentTarget.value)}
          />
        </label>
        <select
          aria-label="Filter theme token group"
          value={sectionFilter}
          onChange={(event) => setSectionFilter(event.currentTarget.value as DashboardThemeSectionKey | "all")}
        >
          <option value="all">All groups</option>
          {DASHBOARD_THEME_FIELD_SECTIONS.map((section) => (
            <option value={section.key} key={section.key}>{section.label}</option>
          ))}
        </select>
      </div>

      {DASHBOARD_THEME_MODES.map((mode) => {
        const selected = activeMode === mode.key;
        return (
        <section
          id={`dashboard-theme-${mode.key}-panel`}
          aria-labelledby={`dashboard-theme-${mode.key}-tab`}
          className="dashboard-theme-mode-card"
          hidden={!selected}
          role="tabpanel"
          tabIndex={0}
          key={mode.key}
        >
          <h3>{mode.label}</h3>
          {visibleFieldSections.length ? visibleFieldSections.map((section) => (
            variant === "drawer" ? (
              <details
                className="dashboard-theme-field-section dashboard-theme-field-section-collapsible"
                data-theme-section-key={section.key}
                key={section.key}
              >
                <summary>
                  <h4>{section.label}</h4>
                </summary>
                <div className="dashboard-theme-grid">
                  {section.fields.map((field) => (
                    <label
                      className="dashboard-theme-field"
                      data-theme-field-key={field.key}
                      data-theme-mode-key={mode.key}
                      key={field.key}
                    >
                      <span>
                        {field.label}
                        <small>{field.description}</small>
                        <small>
                          Default: {tokenRegistryByKey.get(field.key)?.[mode.key === "light" ? "defaultLightValue" : "defaultDarkValue"]}
                        </small>
                        <small className="dashboard-theme-field-status">
                          {draftTheme[mode.key][field.key].toLowerCase() === theme[mode.key][field.key].toLowerCase() ? "Saved value" : "Unsaved change"}
                        </small>
                      </span>
                      <DashboardThemeColorField
                        fieldKey={field.key}
                        label={`${mode.label} ${field.label}`}
                        mode={mode.key}
                        name={dashboardThemeFieldName(mode.key, field.key)}
                        savedValue={theme[mode.key][field.key]}
                        value={draftTheme[mode.key][field.key]}
                        onChange={updateColor}
                      />
                    </label>
                  ))}
                </div>
                {section.key === "toasts" ? (
                  <>
                    <div className="dashboard-theme-toast-preview-grid" style={previewStyles[mode.key]} aria-hidden="true">
                      <div className="dashboard-theme-toast-preview dashboard-theme-toast-preview-success">
                        <CheckCircle2 size={18} aria-hidden />
                        <span>Dashboard theme saved.</span>
                        <X size={15} aria-hidden />
                      </div>
                      <div className="dashboard-theme-toast-preview dashboard-theme-toast-preview-error">
                        <AlertTriangle size={18} aria-hidden />
                        <span>Could not save theme.</span>
                        <X size={15} aria-hidden />
                      </div>
                      <div className="dashboard-theme-toast-preview dashboard-theme-toast-preview-info">
                        <Info size={18} aria-hidden />
                        <span>Settings saved.</span>
                        <X size={15} aria-hidden />
                      </div>
                    </div>
                    {onTestToast ? (
                      <div className="dashboard-theme-toast-test-actions">
                        <button className="secondary" type="button" onClick={() => onTestToast("success")}>
                          Test success
                        </button>
                        <button className="secondary" type="button" onClick={() => onTestToast("error")}>
                          Test error
                        </button>
                        <button className="secondary" type="button" onClick={() => onTestToast("info")}>
                          Test notice
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </details>
            ) : (
              <section className="dashboard-theme-field-section" key={section.key}>
                <h4>{section.label}</h4>
                <div className="dashboard-theme-grid">
                  {section.fields.map((field) => (
                    <label className="dashboard-theme-field" key={field.key}>
                      <span>
                        {field.label}
                        <small>{field.description}</small>
                        <small>
                          Default: {tokenRegistryByKey.get(field.key)?.[mode.key === "light" ? "defaultLightValue" : "defaultDarkValue"]}
                        </small>
                        <small className="dashboard-theme-field-status">
                          {draftTheme[mode.key][field.key].toLowerCase() === theme[mode.key][field.key].toLowerCase() ? "Saved value" : "Unsaved change"}
                        </small>
                      </span>
                      <DashboardThemeColorField
                        fieldKey={field.key}
                        label={`${mode.label} ${field.label}`}
                        mode={mode.key}
                        name={dashboardThemeFieldName(mode.key, field.key)}
                        savedValue={theme[mode.key][field.key]}
                        value={draftTheme[mode.key][field.key]}
                        onChange={updateColor}
                      />
                    </label>
                  ))}
                </div>
                {section.key === "toasts" ? (
                  <div className="dashboard-theme-toast-preview-grid" style={previewStyles[mode.key]} aria-hidden="true">
                    <div className="dashboard-theme-toast-preview dashboard-theme-toast-preview-success">
                      <CheckCircle2 size={18} aria-hidden />
                      <span>Dashboard theme saved.</span>
                      <X size={15} aria-hidden />
                    </div>
                    <div className="dashboard-theme-toast-preview dashboard-theme-toast-preview-error">
                      <AlertTriangle size={18} aria-hidden />
                      <span>Could not save theme.</span>
                      <X size={15} aria-hidden />
                    </div>
                    <div className="dashboard-theme-toast-preview dashboard-theme-toast-preview-info">
                      <Info size={18} aria-hidden />
                      <span>Settings saved.</span>
                      <X size={15} aria-hidden />
                    </div>
                  </div>
                ) : null}
              </section>
            )
          )) : (
            <p className="muted small">No theme tokens match the current filters.</p>
          )}

          {showModePreviews ? <ThemeModePreview label={mode.label} styles={previewStyles[mode.key]} /> : null}
        </section>
        );
      })}
    </div>
  );
}
