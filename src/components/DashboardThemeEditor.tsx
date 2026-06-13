"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  DASHBOARD_THEME_FIELDS,
  DASHBOARD_THEME_MODES,
  dashboardThemeFieldName,
  dashboardThemePaletteCssVariables,
  type DashboardTheme,
  type DashboardThemeKey,
  type DashboardThemeMode,
  type DashboardThemePalette
} from "@/lib/dashboard-theme";

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

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

  return (
    <span className="dashboard-theme-color-row">
      <input
        aria-label={`${label} HEX color`}
        autoCapitalize="none"
        autoComplete="off"
        className="dashboard-theme-hex-input"
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

export function DashboardThemeEditor({ theme }: { theme: DashboardTheme }) {
  const [draftTheme, setDraftTheme] = useState<DashboardTheme>(theme);

  function updateColor(mode: DashboardThemeMode, key: DashboardThemeKey, value: string) {
    setDraftTheme((current) => ({
      ...current,
      [mode]: {
        ...current[mode],
        [key]: value
      }
    }));
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
    <div className="dashboard-theme-mode-grid">
      {DASHBOARD_THEME_MODES.map((mode) => (
        <section className="dashboard-theme-mode-card" key={mode.key}>
          <h3>{mode.label}</h3>
          <div className="dashboard-theme-grid">
            {DASHBOARD_THEME_FIELDS.map((field) => (
              <label className="dashboard-theme-field" key={field.key}>
                <span>
                  {field.label}
                  <small>{field.description}</small>
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

          <div className="dashboard-theme-preview" style={previewStyles[mode.key]} aria-hidden="true">
            <div className="dashboard-theme-preview-sidebar">
              <span>Navigation</span>
              <strong>Dashboard</strong>
              <span>Links</span>
            </div>
            <div className="dashboard-theme-preview-main">
              <div className="dashboard-theme-preview-topbar">Admin toolbar</div>
              <div className="dashboard-theme-preview-panel">
                <strong>{mode.label} preview</strong>
                <span>Short URL metrics and dashboard controls use these colors.</span>
                <div className="dashboard-theme-preview-pills">
                  <span className="dashboard-theme-preview-pill">Default pill</span>
                  <span className="dashboard-theme-preview-pill dashboard-theme-preview-pill-active">Active pill</span>
                </div>
                <button type="button" tabIndex={-1}>Primary action</button>
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
