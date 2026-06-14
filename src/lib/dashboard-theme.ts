export type DashboardThemePalette = {
  accent: string;
  activePillBackground: string;
  activePillBorder: string;
  activePillText: string;
  background: string;
  border: string;
  buttonText: string;
  dangerBackground: string;
  dangerBorder: string;
  dangerText: string;
  muted: string;
  pillBackground: string;
  pillBorder: string;
  pillText: string;
  shortUrlPillAccent: string;
  shortUrlPillBackground: string;
  shortUrlPillBorder: string;
  shortUrlPillText: string;
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
  { key: "buttonText", label: "Button text", description: "Text color on filled buttons." },
  { key: "dangerBackground", label: "Danger", description: "Archive, delete, disabled, and warning states." },
  { key: "dangerText", label: "Danger text", description: "Text for filled danger buttons." },
  { key: "dangerBorder", label: "Danger border", description: "Outline for warning badges and danger buttons." },
  { key: "pillBackground", label: "Default pill", description: "Background for neutral pills and tag badges." },
  { key: "pillText", label: "Default pill text", description: "Text for neutral pills and tag badges." },
  { key: "pillBorder", label: "Default pill border", description: "Outline for neutral pills and tag badges." },
  { key: "activePillBackground", label: "Active pill", description: "Background for active status pills." },
  { key: "activePillText", label: "Active pill text", description: "Text for active status pills." },
  { key: "activePillBorder", label: "Active pill border", description: "Outline for active status pills." },
  { key: "shortUrlPillBackground", label: "Short URL pill", description: "Background behind short link codes." },
  { key: "shortUrlPillText", label: "Short URL text", description: "Text for short link codes." },
  { key: "shortUrlPillBorder", label: "Short URL border", description: "Outline around short link codes." },
  { key: "shortUrlPillAccent", label: "Short URL accent", description: "Left accent bar for short link codes." }
] as const satisfies readonly DashboardThemeField[];

export const DASHBOARD_THEME_MODES = [
  { key: "light", label: "Light mode" },
  { key: "dark", label: "Dark mode" }
] as const satisfies readonly { key: DashboardThemeMode; label: string }[];

export const DEFAULT_DASHBOARD_THEME: DashboardTheme = {
  light: {
    accent: "#087e8b",
    activePillBackground: "#d9ecee",
    activePillBorder: "#8cc5cc",
    activePillText: "#0a5c70",
    background: "#e9f2f6",
    border: "#bdd8e4",
    buttonText: "#ffffff",
    dangerBackground: "#c81d25",
    dangerBorder: "#c81d25",
    dangerText: "#ffffff",
    muted: "#477282",
    pillBackground: "#d8edf4",
    pillBorder: "#bdd8e4",
    pillText: "#0b2636",
    shortUrlPillAccent: "#087e8b",
    shortUrlPillBackground: "#eef8f9",
    shortUrlPillBorder: "#9ed1d7",
    shortUrlPillText: "#0a5c70",
    sidebar: "#0a5c70",
    sidebarHover: "#087e8b",
    surface: "#ffffff",
    surfaceStrong: "#d8edf4",
    text: "#0b2636"
  },
  dark: {
    accent: "#64abbb",
    activePillBackground: "#92c1d3",
    activePillBorder: "#b7d6e2",
    activePillText: "#052f3b",
    background: "#052f3b",
    border: "#3c8ea0",
    buttonText: "#ffffff",
    dangerBackground: "#e65057",
    dangerBorder: "#ff858a",
    dangerText: "#ffffff",
    muted: "#92c1d3",
    pillBackground: "#176d7d",
    pillBorder: "#3c8ea0",
    pillText: "#f3fbff",
    shortUrlPillAccent: "#64abbb",
    shortUrlPillBackground: "#0d4a58",
    shortUrlPillBorder: "#3c8ea0",
    shortUrlPillText: "#f3fbff",
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
    "--active-pill-background": theme.activePillBackground,
    "--active-pill-border": theme.activePillBorder,
    "--active-pill-text": theme.activePillText,
    "--background": theme.background,
    "--border": theme.border,
    "--button-text": theme.buttonText,
    "--chart-color-1": theme.accent,
    "--chart-color-2": theme.sidebarHover,
    "--chart-color-3": theme.surfaceStrong,
    "--chart-color-4": theme.sidebar,
    "--chart-color-5": theme.dangerBackground,
    "--chart-color-6": `color-mix(in srgb, ${theme.surfaceStrong}, ${theme.surface} 35%)`,
    "--chart-color-7": `color-mix(in srgb, ${theme.accent}, ${theme.surface} 45%)`,
    "--chart-map-bucket-1": `color-mix(in srgb, ${theme.accent}, ${theme.surface} 78%)`,
    "--chart-map-bucket-2": `color-mix(in srgb, ${theme.accent}, ${theme.surface} 64%)`,
    "--chart-map-bucket-3": `color-mix(in srgb, ${theme.accent}, ${theme.surface} 48%)`,
    "--chart-map-bucket-4": `color-mix(in srgb, ${theme.accent}, ${theme.surface} 30%)`,
    "--chart-map-bucket-5": theme.sidebar,
    "--chart-map-empty": `color-mix(in srgb, ${theme.surface}, ${theme.surfaceStrong} 42%)`,
    "--chart-tooltip-background": theme.surface,
    "--chart-tooltip-border": theme.border,
    "--chart-tooltip-text": theme.text,
    "--danger-background": theme.dangerBackground,
    "--danger-border": theme.dangerBorder,
    "--danger-text": theme.dangerText,
    "--color-deep-teal": theme.sidebarHover,
    "--color-ice": theme.surfaceStrong,
    "--color-navy": theme.sidebar,
    "--color-teal": theme.accent,
    "--dark-teal": theme.sidebar,
    "--muted": theme.muted,
    "--pacific-blue": theme.border,
    "--pill-background": theme.pillBackground,
    "--pill-border": theme.pillBorder,
    "--pill-text": theme.pillText,
    "--shadow": `0 18px 50px ${theme.sidebar}1f`,
    "--short-url-pill-accent": theme.shortUrlPillAccent,
    "--short-url-pill-background": theme.shortUrlPillBackground,
    "--short-url-pill-border": theme.shortUrlPillBorder,
    "--short-url-pill-text": theme.shortUrlPillText,
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
      [`--dashboard-${mode.key}-active-pill-background`, theme[mode.key].activePillBackground],
      [`--dashboard-${mode.key}-active-pill-border`, theme[mode.key].activePillBorder],
      [`--dashboard-${mode.key}-active-pill-text`, theme[mode.key].activePillText],
      [`--dashboard-${mode.key}-background`, theme[mode.key].background],
      [`--dashboard-${mode.key}-border`, theme[mode.key].border],
      [`--dashboard-${mode.key}-button-text`, theme[mode.key].buttonText],
      [`--dashboard-${mode.key}-danger-background`, theme[mode.key].dangerBackground],
      [`--dashboard-${mode.key}-danger-border`, theme[mode.key].dangerBorder],
      [`--dashboard-${mode.key}-danger-text`, theme[mode.key].dangerText],
      [`--dashboard-${mode.key}-muted`, theme[mode.key].muted],
      [`--dashboard-${mode.key}-pill-background`, theme[mode.key].pillBackground],
      [`--dashboard-${mode.key}-pill-border`, theme[mode.key].pillBorder],
      [`--dashboard-${mode.key}-pill-text`, theme[mode.key].pillText],
      [`--dashboard-${mode.key}-shadow`, `0 18px 50px ${theme[mode.key].sidebar}1f`],
      [`--dashboard-${mode.key}-short-url-pill-accent`, theme[mode.key].shortUrlPillAccent],
      [`--dashboard-${mode.key}-short-url-pill-background`, theme[mode.key].shortUrlPillBackground],
      [`--dashboard-${mode.key}-short-url-pill-border`, theme[mode.key].shortUrlPillBorder],
      [`--dashboard-${mode.key}-short-url-pill-text`, theme[mode.key].shortUrlPillText],
      [`--dashboard-${mode.key}-sidebar`, theme[mode.key].sidebar],
      [`--dashboard-${mode.key}-sidebar-hover`, theme[mode.key].sidebarHover],
      [`--dashboard-${mode.key}-surface`, theme[mode.key].surface],
      [`--dashboard-${mode.key}-surface-strong`, theme[mode.key].surfaceStrong],
      [`--dashboard-${mode.key}-text`, theme[mode.key].text]
    ])
  );
}
