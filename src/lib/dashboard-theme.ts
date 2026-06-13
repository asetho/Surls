export type DashboardThemePalette = {
  accent: string;
  background: string;
  border: string;
  buttonText: string;
  muted: string;
  sidebar: string;
  sidebarHover: string;
  surface: string;
  surfaceStrong: string;
  text: string;
};

export type DashboardTheme = {
  dark: DashboardThemePalette;
  light: DashboardThemePalette;
};

export type DashboardThemeKey = keyof DashboardThemePalette;
export type DashboardThemeMode = keyof DashboardTheme;

type DashboardThemeField = {
  description: string;
  key: DashboardThemeKey;
  label: string;
};

export const DASHBOARD_THEME_FIELDS = [
  { key: "sidebar", label: "Sidebar", description: "Navigation background." },
  { key: "sidebarHover", label: "Sidebar hover", description: "Active and hover states in the sidebar." },
  { key: "accent", label: "Accent", description: "Primary buttons, links, and highlighted values." },
  { key: "background", label: "Page background", description: "Dashboard page background." },
  { key: "surface", label: "Panels", description: "Cards, top bar, tables, and form surfaces." },
  { key: "surfaceStrong", label: "Subtle fill", description: "Badges, previews, and secondary panels." },
  { key: "text", label: "Text", description: "Primary dashboard text." },
  { key: "muted", label: "Muted text", description: "Secondary labels and helper text." },
  { key: "border", label: "Borders", description: "Panel and field outlines." },
  { key: "buttonText", label: "Button text", description: "Text color on filled buttons." }
] as const satisfies readonly DashboardThemeField[];

export const DASHBOARD_THEME_MODES = [
  { key: "light", label: "Light mode" },
  { key: "dark", label: "Dark mode" }
] as const satisfies readonly { key: DashboardThemeMode; label: string }[];

export const DEFAULT_DASHBOARD_THEME: DashboardTheme = {
  light: {
    accent: "#087e8b",
    background: "#e9f2f6",
    border: "#bdd8e4",
    buttonText: "#ffffff",
    muted: "#477282",
    sidebar: "#0a5c70",
    sidebarHover: "#087e8b",
    surface: "#ffffff",
    surfaceStrong: "#d8edf4",
    text: "#0b2636"
  },
  dark: {
    accent: "#64abbb",
    background: "#052f3b",
    border: "#3c8ea0",
    buttonText: "#ffffff",
    muted: "#92c1d3",
    sidebar: "#073f4d",
    sidebarHover: "#087e8b",
    surface: "#0a5c70",
    surfaceStrong: "#176d7d",
    text: "#f3fbff"
  }
};

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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

export function dashboardThemeFieldName(mode: DashboardThemeMode, key: DashboardThemeKey) {
  return `dashboardTheme_${mode}_${key}`;
}

function normalizeDashboardThemePalette(value: unknown, fallback: DashboardThemePalette): DashboardThemePalette {
  if (!isRecord(value)) return fallback;
  return Object.fromEntries(
    DASHBOARD_THEME_FIELDS.map((field) => {
      const storedColor = value[field.key];
      const color = typeof storedColor === "string" ? expandHexColor(storedColor) : null;
      return [field.key, color ?? fallback[field.key]];
    })
  ) as DashboardThemePalette;
}

function isFlatDashboardTheme(value: unknown) {
  return isRecord(value) && DASHBOARD_THEME_FIELDS.some((field) => typeof value[field.key] === "string");
}

export function normalizeDashboardTheme(value: unknown): DashboardTheme {
  if (!isRecord(value)) return DEFAULT_DASHBOARD_THEME;

  if (isFlatDashboardTheme(value)) {
    return {
      light: normalizeDashboardThemePalette(value, DEFAULT_DASHBOARD_THEME.light),
      dark: DEFAULT_DASHBOARD_THEME.dark
    };
  }

  return {
    light: normalizeDashboardThemePalette(value.light, DEFAULT_DASHBOARD_THEME.light),
    dark: normalizeDashboardThemePalette(value.dark, DEFAULT_DASHBOARD_THEME.dark)
  };
}

export function dashboardThemeFromFormData(formData: FormData): DashboardTheme {
  return Object.fromEntries(
    DASHBOARD_THEME_MODES.map((mode) => {
      const palette = Object.fromEntries(
        DASHBOARD_THEME_FIELDS.map((field) => {
          const raw = formData.get(dashboardThemeFieldName(mode.key, field.key));
          const color = typeof raw === "string" ? expandHexColor(raw) : null;
          if (!color) throw new Error(`${mode.label} ${field.label.toLowerCase()} must be a valid hex color.`);
          return [field.key, color];
        })
      ) as DashboardThemePalette;
      return [mode.key, palette];
    })
  ) as DashboardTheme;
}

export function isDefaultDashboardTheme(theme: DashboardTheme) {
  return DASHBOARD_THEME_MODES.every((mode) =>
    DASHBOARD_THEME_FIELDS.every((field) => theme[mode.key][field.key] === DEFAULT_DASHBOARD_THEME[mode.key][field.key])
  );
}

export function dashboardThemePaletteCssVariables(theme: DashboardThemePalette) {
  return {
    "--background": theme.background,
    "--border": theme.border,
    "--button-text": theme.buttonText,
    "--color-deep-teal": theme.sidebarHover,
    "--color-ice": theme.surfaceStrong,
    "--color-navy": theme.sidebar,
    "--color-teal": theme.accent,
    "--dark-teal": theme.sidebar,
    "--muted": theme.muted,
    "--pacific-blue": theme.border,
    "--shadow": `0 18px 50px ${theme.sidebar}1f`,
    "--sky-blue-light": theme.surfaceStrong,
    "--surface": theme.surface,
    "--surface-strong": theme.surfaceStrong,
    "--teal": theme.accent,
    "--text": theme.text
  };
}

export function dashboardThemeCssVariables(theme: DashboardTheme) {
  return Object.fromEntries(
    DASHBOARD_THEME_MODES.flatMap((mode) => [
      [`--dashboard-${mode.key}-accent`, theme[mode.key].accent],
      [`--dashboard-${mode.key}-background`, theme[mode.key].background],
      [`--dashboard-${mode.key}-border`, theme[mode.key].border],
      [`--dashboard-${mode.key}-button-text`, theme[mode.key].buttonText],
      [`--dashboard-${mode.key}-muted`, theme[mode.key].muted],
      [`--dashboard-${mode.key}-shadow`, `0 18px 50px ${theme[mode.key].sidebar}1f`],
      [`--dashboard-${mode.key}-sidebar`, theme[mode.key].sidebar],
      [`--dashboard-${mode.key}-sidebar-hover`, theme[mode.key].sidebarHover],
      [`--dashboard-${mode.key}-surface`, theme[mode.key].surface],
      [`--dashboard-${mode.key}-surface-strong`, theme[mode.key].surfaceStrong],
      [`--dashboard-${mode.key}-text`, theme[mode.key].text]
    ])
  );
}
