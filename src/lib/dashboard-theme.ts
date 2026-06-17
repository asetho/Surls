export type DashboardThemePalette = {
  accent: string;
  activePillBackground: string;
  activePillBorder: string;
  activePillText: string;
  background: string;
  border: string;
  buttonText: string;
  chartAccent: string;
  chartDanger: string;
  chartMapHigh: string;
  chartMapLow: string;
  chartPrimary: string;
  chartSecondary: string;
  dangerBackground: string;
  dangerBorder: string;
  dangerText: string;
  focusRing: string;
  link: string;
  muted: string;
  pillBackground: string;
  pillBorder: string;
  pillText: string;
  qrBackground: string;
  shortUrlPillAccent: string;
  shortUrlPillBackground: string;
  shortUrlPillBorder: string;
  shortUrlPillText: string;
  sidebar: string;
  sidebarBorder: string;
  sidebarHover: string;
  sidebarMuted: string;
  sidebarText: string;
  surface: string;
  surfaceStrong: string;
  text: string;
  overlayBackground: string;
  shadowColor: string;
  toastErrorBackground: string;
  toastErrorBorder: string;
  toastErrorText: string;
  toastSuccessBackground: string;
  toastSuccessBorder: string;
  toastSuccessText: string;
};

export type DashboardTheme = {
  dark: DashboardThemePalette;
  light: DashboardThemePalette;
};

export type DashboardThemeKey = keyof DashboardThemePalette;
export type DashboardThemeMode = keyof DashboardTheme;

export type DashboardThemeField = {
  description: string;
  key: DashboardThemeKey;
  label: string;
};

type DashboardThemeFieldSection = {
  fields: readonly DashboardThemeField[];
  key: "actions" | "graphs" | "panels" | "sidebar" | "toasts";
  label: string;
};

const DASHBOARD_THEME_SIDEBAR_FIELDS: readonly DashboardThemeField[] = [
  { key: "sidebar", label: "Sidebar", description: "Navigation background." },
  { key: "sidebarHover", label: "Sidebar hover", description: "Active and hover states in the sidebar." },
  { key: "sidebarText", label: "Sidebar text", description: "Navigation labels and account text." },
  { key: "sidebarMuted", label: "Sidebar muted", description: "Sidebar helper text and version labels." },
  { key: "sidebarBorder", label: "Sidebar border", description: "Sidebar control and divider outlines." },
  { key: "accent", label: "Accent", description: "Primary buttons, links, and highlighted values." }
] as const;

const DASHBOARD_THEME_PANEL_FIELDS: readonly DashboardThemeField[] = [
  { key: "background", label: "Page background", description: "Dashboard page background." },
  { key: "surface", label: "Panels", description: "Cards, top bar, tables, and form surfaces." },
  { key: "surfaceStrong", label: "Subtle fill", description: "Badges, previews, and secondary panels." },
  { key: "text", label: "Text", description: "Primary dashboard text." },
  { key: "muted", label: "Muted text", description: "Secondary labels and helper text." },
  { key: "border", label: "Borders", description: "Panel and field outlines." },
  { key: "focusRing", label: "Focus ring", description: "Keyboard focus outlines and selected controls." },
  { key: "overlayBackground", label: "Overlay", description: "Modal backdrop tint." },
  { key: "shadowColor", label: "Shadow", description: "Tint used for dashboard panel shadows." },
  { key: "qrBackground", label: "QR background", description: "Background behind generated QR codes." },
  { key: "link", label: "Links", description: "Inline dashboard links and destination URLs." }
] as const;

const DASHBOARD_THEME_ACTION_FIELDS: readonly DashboardThemeField[] = [
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
] as const;

const DASHBOARD_THEME_GRAPH_FIELDS: readonly DashboardThemeField[] = [
  { key: "chartPrimary", label: "Line graph", description: "Primary line and graph highlights." },
  { key: "chartSecondary", label: "Graph secondary", description: "Secondary chart series and supporting marks." },
  { key: "chartAccent", label: "Graph fill", description: "Area fills, neutral chart marks, and soft segments." },
  { key: "chartDanger", label: "Graph warning", description: "Warning slices and high-attention chart marks." },
  { key: "chartMapLow", label: "Map low", description: "Lower-traffic country map color." },
  { key: "chartMapHigh", label: "Map high", description: "Highest-traffic country map color." }
] as const;

const DASHBOARD_THEME_TOAST_FIELDS: readonly DashboardThemeField[] = [
  { key: "toastSuccessBackground", label: "Success background", description: "Saved and completed notifications." },
  { key: "toastSuccessText", label: "Success text", description: "Text for success notifications." },
  { key: "toastSuccessBorder", label: "Success border", description: "Accent and outline for success notifications." },
  { key: "toastErrorBackground", label: "Error background", description: "Failed action notifications." },
  { key: "toastErrorText", label: "Error text", description: "Text for error notifications." },
  { key: "toastErrorBorder", label: "Error border", description: "Accent and outline for error notifications." }
] as const;

export const DASHBOARD_THEME_FIELD_SECTIONS: readonly DashboardThemeFieldSection[] = [
  { key: "sidebar", label: "Sidebar", fields: DASHBOARD_THEME_SIDEBAR_FIELDS },
  { key: "panels", label: "Panels & text", fields: DASHBOARD_THEME_PANEL_FIELDS },
  { key: "actions", label: "Action buttons & pills", fields: DASHBOARD_THEME_ACTION_FIELDS },
  { key: "graphs", label: "Graphs & maps", fields: DASHBOARD_THEME_GRAPH_FIELDS },
  { key: "toasts", label: "Toast notifications", fields: DASHBOARD_THEME_TOAST_FIELDS }
] as const;

export const DASHBOARD_THEME_FIELDS: readonly DashboardThemeField[] = DASHBOARD_THEME_FIELD_SECTIONS.flatMap(
  (section) => section.fields
);

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
    chartAccent: "#d8edf4",
    chartDanger: "#c81d25",
    chartMapHigh: "#0a5c70",
    chartMapLow: "#d8edf4",
    chartPrimary: "#087e8b",
    chartSecondary: "#0a5c70",
    dangerBackground: "#c81d25",
    dangerBorder: "#c81d25",
    dangerText: "#ffffff",
    focusRing: "#087e8b",
    link: "#087e8b",
    muted: "#477282",
    pillBackground: "#d8edf4",
    pillBorder: "#bdd8e4",
    pillText: "#0b2636",
    qrBackground: "#ffffff",
    shortUrlPillAccent: "#087e8b",
    shortUrlPillBackground: "#eef8f9",
    shortUrlPillBorder: "#9ed1d7",
    shortUrlPillText: "#0a5c70",
    sidebar: "#0a5c70",
    sidebarBorder: "#70a7b2",
    sidebarHover: "#087e8b",
    sidebarMuted: "#c0dde3",
    sidebarText: "#ffffff",
    surface: "#ffffff",
    surfaceStrong: "#d8edf4",
    text: "#0b2636",
    overlayBackground: "#0b2636",
    shadowColor: "#0a5c70",
    toastErrorBackground: "#ffffff",
    toastErrorBorder: "#c81d25",
    toastErrorText: "#0b2636",
    toastSuccessBackground: "#ffffff",
    toastSuccessBorder: "#087e8b",
    toastSuccessText: "#0b2636"
  },
  dark: {
    accent: "#64abbb",
    activePillBackground: "#92c1d3",
    activePillBorder: "#b7d6e2",
    activePillText: "#052f3b",
    background: "#052f3b",
    border: "#3c8ea0",
    buttonText: "#ffffff",
    chartAccent: "#176d7d",
    chartDanger: "#e65057",
    chartMapHigh: "#92c1d3",
    chartMapLow: "#176d7d",
    chartPrimary: "#64abbb",
    chartSecondary: "#087e8b",
    dangerBackground: "#e65057",
    dangerBorder: "#ff858a",
    dangerText: "#ffffff",
    focusRing: "#64abbb",
    link: "#8ed6e4",
    muted: "#92c1d3",
    pillBackground: "#176d7d",
    pillBorder: "#3c8ea0",
    pillText: "#f3fbff",
    qrBackground: "#ffffff",
    shortUrlPillAccent: "#64abbb",
    shortUrlPillBackground: "#0d4a58",
    shortUrlPillBorder: "#3c8ea0",
    shortUrlPillText: "#f3fbff",
    sidebar: "#073f4d",
    sidebarBorder: "#3c8ea0",
    sidebarHover: "#087e8b",
    sidebarMuted: "#b7d6e2",
    sidebarText: "#f3fbff",
    surface: "#0a5c70",
    surfaceStrong: "#176d7d",
    text: "#f3fbff",
    overlayBackground: "#000000",
    shadowColor: "#000000",
    toastErrorBackground: "#0a5c70",
    toastErrorBorder: "#ff858a",
    toastErrorText: "#f3fbff",
    toastSuccessBackground: "#0a5c70",
    toastSuccessBorder: "#64abbb",
    toastSuccessText: "#f3fbff"
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

export function dashboardThemeToFormData(theme: DashboardTheme) {
  const formData = new FormData();

  for (const mode of DASHBOARD_THEME_MODES) {
    for (const field of DASHBOARD_THEME_FIELDS) {
      formData.set(dashboardThemeFieldName(mode.key, field.key), theme[mode.key][field.key]);
    }
  }

  return formData;
}

export function isDefaultDashboardTheme(theme: DashboardTheme) {
  return DASHBOARD_THEME_MODES.every((mode) =>
    DASHBOARD_THEME_FIELDS.every((field) => theme[mode.key][field.key] === DEFAULT_DASHBOARD_THEME[mode.key][field.key])
  );
}

function dashboardThemeStatsTabCssVariables(theme: DashboardThemePalette, prefix = "--") {
  return {
    [`${prefix}stats-tab-active-background`]: theme.chartPrimary,
    [`${prefix}stats-tab-active-border`]: theme.chartPrimary,
    [`${prefix}stats-tab-active-text`]: theme.buttonText,
    [`${prefix}stats-tab-background`]: `color-mix(in srgb, ${theme.chartAccent}, ${theme.surface} 50%)`,
    [`${prefix}stats-tab-border`]: `color-mix(in srgb, ${theme.chartSecondary}, ${theme.border} 45%)`,
    [`${prefix}stats-tab-list-background`]: theme.chartAccent,
    [`${prefix}stats-tab-text`]: `color-mix(in srgb, ${theme.chartSecondary}, transparent 32%)`
  };
}

export function dashboardThemePaletteCssVariables(theme: DashboardThemePalette) {
  return {
    "--active-pill-background": theme.activePillBackground,
    "--active-pill-border": theme.activePillBorder,
    "--active-pill-text": theme.activePillText,
    "--background": theme.background,
    "--border": theme.border,
    "--button-text": theme.buttonText,
    "--chart-color-1": theme.chartPrimary,
    "--chart-color-2": theme.chartSecondary,
    "--chart-color-3": theme.chartAccent,
    "--chart-color-4": theme.chartMapHigh,
    "--chart-color-5": theme.chartDanger,
    "--chart-color-6": `color-mix(in srgb, ${theme.chartAccent}, ${theme.surface} 35%)`,
    "--chart-color-7": `color-mix(in srgb, ${theme.chartPrimary}, ${theme.surface} 45%)`,
    "--chart-map-bucket-1": theme.chartMapLow,
    "--chart-map-bucket-2": `color-mix(in srgb, ${theme.chartMapLow}, ${theme.chartMapHigh} 25%)`,
    "--chart-map-bucket-3": `color-mix(in srgb, ${theme.chartMapLow}, ${theme.chartMapHigh} 50%)`,
    "--chart-map-bucket-4": `color-mix(in srgb, ${theme.chartMapLow}, ${theme.chartMapHigh} 75%)`,
    "--chart-map-bucket-5": theme.chartMapHigh,
    "--chart-map-empty": `color-mix(in srgb, ${theme.surface}, ${theme.surfaceStrong} 42%)`,
    "--chart-tooltip-background": theme.surface,
    "--chart-tooltip-border": theme.border,
    "--chart-tooltip-text": theme.text,
    "--danger-background": theme.dangerBackground,
    "--danger-border": theme.dangerBorder,
    "--danger-text": theme.dangerText,
    "--focus-ring": `0 0 0 3px ${theme.focusRing}55`,
    "--link-color": theme.link,
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
    "--qr-background": theme.qrBackground,
    "--overlay-background": theme.overlayBackground,
    "--shadow": `0 18px 50px ${theme.shadowColor}1f`,
    "--sidebar-border": theme.sidebarBorder,
    "--sidebar-muted": theme.sidebarMuted,
    "--sidebar-text": theme.sidebarText,
    "--short-url-pill-accent": theme.shortUrlPillAccent,
    "--short-url-pill-background": theme.shortUrlPillBackground,
    "--short-url-pill-border": theme.shortUrlPillBorder,
    "--short-url-pill-text": theme.shortUrlPillText,
    "--sky-blue-light": theme.surfaceStrong,
    "--surface": theme.surface,
    "--surface-strong": theme.surfaceStrong,
    "--teal": theme.accent,
    "--text": theme.text,
    ...dashboardThemeStatsTabCssVariables(theme),
    "--toast-error-background": theme.toastErrorBackground,
    "--toast-error-border": theme.toastErrorBorder,
    "--toast-error-text": theme.toastErrorText,
    "--toast-success-background": theme.toastSuccessBackground,
    "--toast-success-border": theme.toastSuccessBorder,
    "--toast-success-text": theme.toastSuccessText
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
      [`--dashboard-${mode.key}-chart-accent`, theme[mode.key].chartAccent],
      [`--dashboard-${mode.key}-chart-danger`, theme[mode.key].chartDanger],
      [`--dashboard-${mode.key}-chart-map-high`, theme[mode.key].chartMapHigh],
      [`--dashboard-${mode.key}-chart-map-low`, theme[mode.key].chartMapLow],
      [`--dashboard-${mode.key}-chart-primary`, theme[mode.key].chartPrimary],
      [`--dashboard-${mode.key}-chart-secondary`, theme[mode.key].chartSecondary],
      [`--dashboard-${mode.key}-danger-background`, theme[mode.key].dangerBackground],
      [`--dashboard-${mode.key}-danger-border`, theme[mode.key].dangerBorder],
      [`--dashboard-${mode.key}-danger-text`, theme[mode.key].dangerText],
      [`--dashboard-${mode.key}-focus-ring`, `0 0 0 3px ${theme[mode.key].focusRing}55`],
      [`--dashboard-${mode.key}-link`, theme[mode.key].link],
      [`--dashboard-${mode.key}-muted`, theme[mode.key].muted],
      [`--dashboard-${mode.key}-pill-background`, theme[mode.key].pillBackground],
      [`--dashboard-${mode.key}-pill-border`, theme[mode.key].pillBorder],
      [`--dashboard-${mode.key}-pill-text`, theme[mode.key].pillText],
      [`--dashboard-${mode.key}-qr-background`, theme[mode.key].qrBackground],
      [`--dashboard-${mode.key}-overlay-background`, theme[mode.key].overlayBackground],
      [`--dashboard-${mode.key}-shadow`, `0 18px 50px ${theme[mode.key].shadowColor}1f`],
      [`--dashboard-${mode.key}-shadow-color`, theme[mode.key].shadowColor],
      ...Object.entries(dashboardThemeStatsTabCssVariables(theme[mode.key], `--dashboard-${mode.key}-`)),
      [`--dashboard-${mode.key}-short-url-pill-accent`, theme[mode.key].shortUrlPillAccent],
      [`--dashboard-${mode.key}-short-url-pill-background`, theme[mode.key].shortUrlPillBackground],
      [`--dashboard-${mode.key}-short-url-pill-border`, theme[mode.key].shortUrlPillBorder],
      [`--dashboard-${mode.key}-short-url-pill-text`, theme[mode.key].shortUrlPillText],
      [`--dashboard-${mode.key}-sidebar`, theme[mode.key].sidebar],
      [`--dashboard-${mode.key}-sidebar-border`, theme[mode.key].sidebarBorder],
      [`--dashboard-${mode.key}-sidebar-hover`, theme[mode.key].sidebarHover],
      [`--dashboard-${mode.key}-sidebar-muted`, theme[mode.key].sidebarMuted],
      [`--dashboard-${mode.key}-sidebar-text`, theme[mode.key].sidebarText],
      [`--dashboard-${mode.key}-surface`, theme[mode.key].surface],
      [`--dashboard-${mode.key}-surface-strong`, theme[mode.key].surfaceStrong],
      [`--dashboard-${mode.key}-text`, theme[mode.key].text],
      [`--dashboard-${mode.key}-toast-error-background`, theme[mode.key].toastErrorBackground],
      [`--dashboard-${mode.key}-toast-error-border`, theme[mode.key].toastErrorBorder],
      [`--dashboard-${mode.key}-toast-error-text`, theme[mode.key].toastErrorText],
      [`--dashboard-${mode.key}-toast-success-background`, theme[mode.key].toastSuccessBackground],
      [`--dashboard-${mode.key}-toast-success-border`, theme[mode.key].toastSuccessBorder],
      [`--dashboard-${mode.key}-toast-success-text`, theme[mode.key].toastSuccessText]
    ])
  );
}
