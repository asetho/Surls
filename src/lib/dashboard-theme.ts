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
  segmentedControlActiveBackground: string;
  segmentedControlActiveText: string;
  segmentedControlBackground: string;
  segmentedControlBorder: string;
  segmentedControlText: string;
  shortUrlPillAccent: string;
  shortUrlPillBackground: string;
  shortUrlPillBorder: string;
  shortUrlPillText: string;
  sidebar: string;
  sidebarBorder: string;
  sidebarHover: string;
  sidebarMuted: string;
  sidebarText: string;
  statsTabActiveBackground: string;
  statsTabActiveBorder: string;
  statsTabActiveText: string;
  statsTabBackground: string;
  statsTabBorder: string;
  statsTabListBackground: string;
  statsTabText: string;
  surface: string;
  surfaceStrong: string;
  text: string;
  overlayBackground: string;
  placeholder: string;
  shadowColor: string;
  toastErrorBackground: string;
  toastErrorBorder: string;
  toastErrorText: string;
  toastInfoBackground: string;
  toastInfoBorder: string;
  toastInfoText: string;
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

export type DashboardThemeTokenRegistryEntry = DashboardThemeField & {
  category: string;
  cssCustomProperty: `--${string}`;
  defaultDarkValue: string;
  defaultLightValue: string;
  deprecated?: boolean;
  editable: boolean;
  editorControl: "color" | "readonly";
  exampleUsage: string;
  fallbackBehavior: string;
  id: string;
  readOnlyReason?: string;
  replacementToken?: DashboardThemeKey;
  scope: "admin-shell" | "bookmarklet-shell" | "global";
  subcategory: string;
  valueType: "color" | "shadow";
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
  { key: "overlayBackground", label: "Overlay", description: "Modal backdrop tint." },
  { key: "placeholder", label: "Placeholder text", description: "Text inside empty form fields." },
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
  { key: "shortUrlPillAccent", label: "Short URL accent", description: "Left accent bar for short link codes." },
  { key: "segmentedControlBackground", label: "Segmented control", description: "Track behind compact choices and graph tabs." },
  { key: "segmentedControlText", label: "Segmented text", description: "Inactive compact choice and graph tab text." },
  { key: "segmentedControlBorder", label: "Segmented border", description: "Outline for compact choice groups and graph tabs." },
  {
    key: "segmentedControlActiveBackground",
    label: "Segmented active",
    description: "Background for the selected compact choice or graph tab."
  },
  { key: "segmentedControlActiveText", label: "Segmented active text", description: "Text for the selected compact choice or graph tab." }
] as const;

const DASHBOARD_THEME_GRAPH_FIELDS: readonly DashboardThemeField[] = [
  { key: "chartPrimary", label: "Line graph", description: "Primary line and graph highlights." },
  { key: "chartSecondary", label: "Graph secondary", description: "Secondary chart series and supporting marks." },
  { key: "chartAccent", label: "Graph fill", description: "Area fills, neutral chart marks, and soft segments." },
  { key: "chartDanger", label: "Graph warning", description: "Warning slices and high-attention chart marks." },
  { key: "chartMapLow", label: "Map low", description: "Lower-traffic country map color." },
  { key: "chartMapHigh", label: "Map high", description: "Highest-traffic country map color." }
] as const;

const DASHBOARD_THEME_LEGACY_STATS_TAB_FIELDS: readonly DashboardThemeField[] = [
  { key: "statsTabListBackground", label: "Graph tab line", description: "Underline track behind graph tabs." },
  { key: "statsTabBackground", label: "Graph tab inactive", description: "Background for inactive graph tabs." },
  { key: "statsTabText", label: "Graph tab inactive text", description: "Text for inactive graph tabs." },
  { key: "statsTabBorder", label: "Graph tab border", description: "Outline and underline for graph tabs." },
  { key: "statsTabActiveBackground", label: "Graph tab active", description: "Background for the selected graph tab." },
  { key: "statsTabActiveText", label: "Graph tab active text", description: "Text for the selected graph tab." },
  { key: "statsTabActiveBorder", label: "Graph tab active border", description: "Outline for the selected graph tab." }
] as const;

const DASHBOARD_THEME_TOAST_FIELDS: readonly DashboardThemeField[] = [
  { key: "toastSuccessBackground", label: "Success background", description: "Saved and completed notifications." },
  { key: "toastSuccessText", label: "Success text", description: "Text for success notifications." },
  { key: "toastSuccessBorder", label: "Success border", description: "Accent and outline for success notifications." },
  { key: "toastErrorBackground", label: "Error background", description: "Failed action notifications." },
  { key: "toastErrorText", label: "Error text", description: "Text for error notifications." },
  { key: "toastErrorBorder", label: "Error border", description: "Accent and outline for error notifications." },
  { key: "toastInfoBackground", label: "Notice background", description: "Neutral status and informational notifications." },
  { key: "toastInfoText", label: "Notice text", description: "Text for neutral notifications." },
  { key: "toastInfoBorder", label: "Notice border", description: "Accent and outline for neutral notifications." }
] as const;

const DASHBOARD_THEME_LEGACY_FOCUS_RING_FIELD: DashboardThemeField = {
  key: "focusRing",
  label: "Focus ring",
  description: "Legacy saved focus color."
};

export const DASHBOARD_THEME_FIELD_SECTIONS: readonly DashboardThemeFieldSection[] = [
  { key: "sidebar", label: "Sidebar", fields: DASHBOARD_THEME_SIDEBAR_FIELDS },
  { key: "panels", label: "Panels & text", fields: DASHBOARD_THEME_PANEL_FIELDS },
  { key: "actions", label: "Action buttons & pills", fields: DASHBOARD_THEME_ACTION_FIELDS },
  { key: "graphs", label: "Graphs & maps", fields: DASHBOARD_THEME_GRAPH_FIELDS },
  { key: "toasts", label: "Toast notifications", fields: DASHBOARD_THEME_TOAST_FIELDS }
] as const;

export const DASHBOARD_THEME_EDITABLE_FIELDS: readonly DashboardThemeField[] = DASHBOARD_THEME_FIELD_SECTIONS.flatMap(
  (section) => section.fields
);

export const DASHBOARD_THEME_FIELDS: readonly DashboardThemeField[] = [
  ...DASHBOARD_THEME_EDITABLE_FIELDS,
  ...DASHBOARD_THEME_LEGACY_STATS_TAB_FIELDS,
  DASHBOARD_THEME_LEGACY_FOCUS_RING_FIELD
];

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
    segmentedControlActiveBackground: "#087e8b",
    segmentedControlActiveText: "#ffffff",
    segmentedControlBackground: "#d8edf4",
    segmentedControlBorder: "#8cc5cc",
    segmentedControlText: "#477282",
    shortUrlPillAccent: "#087e8b",
    shortUrlPillBackground: "#eef8f9",
    shortUrlPillBorder: "#9ed1d7",
    shortUrlPillText: "#0a5c70",
    sidebar: "#0a5c70",
    sidebarBorder: "#70a7b2",
    sidebarHover: "#087e8b",
    sidebarMuted: "#c0dde3",
    sidebarText: "#ffffff",
    statsTabActiveBackground: "#087e8b",
    statsTabActiveBorder: "#087e8b",
    statsTabActiveText: "#ffffff",
    statsTabBackground: "#d8edf4",
    statsTabBorder: "#8cc5cc",
    statsTabListBackground: "#d8edf4",
    statsTabText: "#477282",
    surface: "#ffffff",
    surfaceStrong: "#d8edf4",
    text: "#0b2636",
    overlayBackground: "#0b2636",
    placeholder: "#6f8a96",
    shadowColor: "#0a5c70",
    toastErrorBackground: "#ffffff",
    toastErrorBorder: "#c81d25",
    toastErrorText: "#0b2636",
    toastInfoBackground: "#d8edf4",
    toastInfoBorder: "#bdd8e4",
    toastInfoText: "#0b2636",
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
    segmentedControlActiveBackground: "#64abbb",
    segmentedControlActiveText: "#ffffff",
    segmentedControlBackground: "#176d7d",
    segmentedControlBorder: "#3c8ea0",
    segmentedControlText: "#b7d6e2",
    shortUrlPillAccent: "#64abbb",
    shortUrlPillBackground: "#0d4a58",
    shortUrlPillBorder: "#3c8ea0",
    shortUrlPillText: "#f3fbff",
    sidebar: "#073f4d",
    sidebarBorder: "#3c8ea0",
    sidebarHover: "#087e8b",
    sidebarMuted: "#b7d6e2",
    sidebarText: "#f3fbff",
    statsTabActiveBackground: "#64abbb",
    statsTabActiveBorder: "#64abbb",
    statsTabActiveText: "#ffffff",
    statsTabBackground: "#176d7d",
    statsTabBorder: "#3c8ea0",
    statsTabListBackground: "#176d7d",
    statsTabText: "#b7d6e2",
    surface: "#0a5c70",
    surfaceStrong: "#176d7d",
    text: "#f3fbff",
    overlayBackground: "#000000",
    placeholder: "#b7d6e2",
    shadowColor: "#000000",
    toastErrorBackground: "#0a5c70",
    toastErrorBorder: "#ff858a",
    toastErrorText: "#f3fbff",
    toastInfoBackground: "#176d7d",
    toastInfoBorder: "#3c8ea0",
    toastInfoText: "#f3fbff",
    toastSuccessBackground: "#0a5c70",
    toastSuccessBorder: "#64abbb",
    toastSuccessText: "#f3fbff"
  }
};

const DASHBOARD_THEME_SECTION_METADATA: Record<DashboardThemeFieldSection["key"], { category: string; subcategory: string; exampleUsage: string }> = {
  actions: {
    category: "Buttons and controls",
    subcategory: "Actions, pills, and tabs",
    exampleUsage: "Buttons, badges, short URL pills, segmented controls, and graph tabs."
  },
  graphs: {
    category: "Tables and data views",
    subcategory: "Charts and maps",
    exampleUsage: "Historical click charts, distribution charts, map buckets, and tooltips."
  },
  panels: {
    category: "Surfaces and backgrounds",
    subcategory: "Panels, fields, and text",
    exampleUsage: "Admin content background, panels, form fields, inline links, and modal overlays."
  },
  sidebar: {
    category: "Navigation",
    subcategory: "Sidebar and brand",
    exampleUsage: "Admin sidebar, mobile navigation drawer, account area, and primary accent color."
  },
  toasts: {
    category: "Status and feedback",
    subcategory: "Toast notifications",
    exampleUsage: "Success, error, and informational toast messages."
  }
};

const DASHBOARD_THEME_COMPATIBILITY_FIELDS = new Map<DashboardThemeKey, Pick<DashboardThemeTokenRegistryEntry, "category" | "deprecated" | "exampleUsage" | "readOnlyReason" | "replacementToken" | "subcategory">>([
  [
    "focusRing",
    {
      category: "Borders and focus",
      subcategory: "Focus rings",
      exampleUsage: "Derived focus outline used by interactive admin controls.",
      readOnlyReason: "The rendered focus ring is derived from button text, accent, and text colors so it keeps contrast in both modes."
    }
  ],
  [
    "statsTabListBackground",
    {
      category: "Buttons and controls",
      deprecated: true,
      exampleUsage: "Compatibility value for older saved graph-tab themes.",
      readOnlyReason: "Graph tabs now share segmented-control tokens; this alias remains for saved theme compatibility.",
      replacementToken: "segmentedControlBackground",
      subcategory: "Legacy graph tabs"
    }
  ],
  [
    "statsTabBackground",
    {
      category: "Buttons and controls",
      deprecated: true,
      exampleUsage: "Compatibility value for older saved graph-tab themes.",
      readOnlyReason: "Graph tabs now share segmented-control tokens; this alias remains for saved theme compatibility.",
      replacementToken: "segmentedControlBackground",
      subcategory: "Legacy graph tabs"
    }
  ],
  [
    "statsTabText",
    {
      category: "Buttons and controls",
      deprecated: true,
      exampleUsage: "Compatibility value for older saved graph-tab themes.",
      readOnlyReason: "Graph tabs now share segmented-control tokens; this alias remains for saved theme compatibility.",
      replacementToken: "segmentedControlText",
      subcategory: "Legacy graph tabs"
    }
  ],
  [
    "statsTabBorder",
    {
      category: "Buttons and controls",
      deprecated: true,
      exampleUsage: "Compatibility value for older saved graph-tab themes.",
      readOnlyReason: "Graph tabs now share segmented-control tokens; this alias remains for saved theme compatibility.",
      replacementToken: "segmentedControlBorder",
      subcategory: "Legacy graph tabs"
    }
  ],
  [
    "statsTabActiveBackground",
    {
      category: "Buttons and controls",
      deprecated: true,
      exampleUsage: "Compatibility value for older saved graph-tab themes.",
      readOnlyReason: "Graph tabs now share segmented-control tokens; this alias remains for saved theme compatibility.",
      replacementToken: "segmentedControlActiveBackground",
      subcategory: "Legacy graph tabs"
    }
  ],
  [
    "statsTabActiveText",
    {
      category: "Buttons and controls",
      deprecated: true,
      exampleUsage: "Compatibility value for older saved graph-tab themes.",
      readOnlyReason: "Graph tabs now share segmented-control tokens; this alias remains for saved theme compatibility.",
      replacementToken: "segmentedControlActiveText",
      subcategory: "Legacy graph tabs"
    }
  ],
  [
    "statsTabActiveBorder",
    {
      category: "Buttons and controls",
      deprecated: true,
      exampleUsage: "Compatibility value for older saved graph-tab themes.",
      readOnlyReason: "Graph tabs now share segmented-control tokens; this alias remains for saved theme compatibility.",
      replacementToken: "segmentedControlActiveBackground",
      subcategory: "Legacy graph tabs"
    }
  ]
]);

function dashboardThemeCssCustomPropertyName(key: DashboardThemeKey) {
  return `--dashboard-active-${key.replace(/[A-Z]/g, "-$&").toLowerCase()}` as const;
}

function dashboardThemeFieldSection(fieldKey: DashboardThemeKey) {
  return DASHBOARD_THEME_FIELD_SECTIONS.find((section) => section.fields.some((field) => field.key === fieldKey));
}

export const DASHBOARD_THEME_TOKEN_REGISTRY: readonly DashboardThemeTokenRegistryEntry[] = DASHBOARD_THEME_FIELDS.map(
  (field) => {
    const section = dashboardThemeFieldSection(field.key);
    const sectionMetadata = section ? DASHBOARD_THEME_SECTION_METADATA[section.key] : null;
    const compatibilityMetadata = DASHBOARD_THEME_COMPATIBILITY_FIELDS.get(field.key);
    const editable = DASHBOARD_THEME_EDITABLE_FIELDS.some((editableField) => editableField.key === field.key);
    const valueType = field.key === "shadowColor" || field.key === "focusRing" ? "shadow" : "color";

    return {
      ...field,
      category: compatibilityMetadata?.category ?? sectionMetadata?.category ?? "Advanced structural values",
      cssCustomProperty: dashboardThemeCssCustomPropertyName(field.key),
      defaultDarkValue: DEFAULT_DASHBOARD_THEME.dark[field.key],
      defaultLightValue: DEFAULT_DASHBOARD_THEME.light[field.key],
      deprecated: compatibilityMetadata?.deprecated,
      editable,
      editorControl: editable ? "color" : "readonly",
      exampleUsage: compatibilityMetadata?.exampleUsage ?? sectionMetadata?.exampleUsage ?? "Derived dashboard styling value.",
      fallbackBehavior: "Missing or invalid saved values fall back to DEFAULT_DASHBOARD_THEME during normalization.",
      id: `dashboard.${field.key}`,
      readOnlyReason: editable
        ? undefined
        : compatibilityMetadata?.readOnlyReason ?? "Read-only compatibility token derived from editable theme values.",
      replacementToken: compatibilityMetadata?.replacementToken,
      scope: "admin-shell",
      subcategory: compatibilityMetadata?.subcategory ?? sectionMetadata?.subcategory ?? "Compatibility",
      valueType
    };
  }
);

export const DASHBOARD_THEME_EDITABLE_TOKEN_REGISTRY = DASHBOARD_THEME_TOKEN_REGISTRY.filter((token) => token.editable);

export function dashboardThemeTokenByKey(key: DashboardThemeKey) {
  return DASHBOARD_THEME_TOKEN_REGISTRY.find((token) => token.key === key);
}

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
      const palette = {
        ...DEFAULT_DASHBOARD_THEME[mode.key],
        ...Object.fromEntries(
          DASHBOARD_THEME_EDITABLE_FIELDS.map((field) => {
            const raw = formData.get(dashboardThemeFieldName(mode.key, field.key));
            const color = typeof raw === "string" ? expandHexColor(raw) : null;
            if (!color) throw new Error(`${mode.label} ${field.label.toLowerCase()} must be a valid hex color.`);
            return [field.key, color];
          })
        )
      } as DashboardThemePalette;
      return [mode.key, palette];
    })
  ) as DashboardTheme;
}

export function dashboardThemeToFormData(theme: DashboardTheme) {
  const formData = new FormData();

  for (const mode of DASHBOARD_THEME_MODES) {
    for (const field of DASHBOARD_THEME_EDITABLE_FIELDS) {
      formData.set(dashboardThemeFieldName(mode.key, field.key), theme[mode.key][field.key]);
    }
  }

  return formData;
}

export function isDefaultDashboardTheme(theme: DashboardTheme) {
  return DASHBOARD_THEME_MODES.every((mode) =>
    DASHBOARD_THEME_EDITABLE_FIELDS.every(
      (field) => theme[mode.key][field.key] === DEFAULT_DASHBOARD_THEME[mode.key][field.key]
    )
  );
}

function dashboardThemeFocusRing(theme: DashboardThemePalette) {
  return [
    `0 0 0 2px color-mix(in srgb, ${theme.buttonText}, transparent 14%)`,
    `0 0 0 4px color-mix(in srgb, ${theme.accent}, ${theme.text} 30%)`
  ].join(", ");
}

function dashboardThemeStatsTabCssVariables(theme: DashboardThemePalette, prefix = "--") {
  return {
    [`${prefix}stats-tab-active-background`]: theme.statsTabActiveBackground,
    [`${prefix}stats-tab-active-border`]: theme.statsTabActiveBorder,
    [`${prefix}stats-tab-active-text`]: theme.statsTabActiveText,
    [`${prefix}stats-tab-background`]: theme.statsTabBackground,
    [`${prefix}stats-tab-border`]: theme.statsTabBorder,
    [`${prefix}stats-tab-list-background`]: theme.statsTabListBackground,
    [`${prefix}stats-tab-text`]: theme.statsTabText
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
    "--chart-map-empty": `color-mix(in srgb, ${theme.chartMapLow}, ${theme.surface} 62%)`,
    "--chart-tooltip-background": theme.surface,
    "--chart-tooltip-border": theme.border,
    "--chart-tooltip-text": theme.text,
    "--danger-background": theme.dangerBackground,
    "--danger-border": theme.dangerBorder,
    "--danger-text": theme.dangerText,
    "--focus-ring": dashboardThemeFocusRing(theme),
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
    "--segmented-control-active-background": theme.segmentedControlActiveBackground,
    "--segmented-control-active-text": theme.segmentedControlActiveText,
    "--segmented-control-background": theme.segmentedControlBackground,
    "--segmented-control-border": theme.segmentedControlBorder,
    "--segmented-control-text": theme.segmentedControlText,
    "--overlay-background": theme.overlayBackground,
    "--placeholder": theme.placeholder,
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
    "--toast-info-background": theme.toastInfoBackground,
    "--toast-info-border": theme.toastInfoBorder,
    "--toast-info-text": theme.toastInfoText,
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
      [`--dashboard-${mode.key}-focus-ring`, dashboardThemeFocusRing(theme[mode.key])],
      [`--dashboard-${mode.key}-link`, theme[mode.key].link],
      [`--dashboard-${mode.key}-muted`, theme[mode.key].muted],
      [`--dashboard-${mode.key}-pill-background`, theme[mode.key].pillBackground],
      [`--dashboard-${mode.key}-pill-border`, theme[mode.key].pillBorder],
      [`--dashboard-${mode.key}-pill-text`, theme[mode.key].pillText],
      [`--dashboard-${mode.key}-qr-background`, theme[mode.key].qrBackground],
      [`--dashboard-${mode.key}-segmented-control-active-background`, theme[mode.key].segmentedControlActiveBackground],
      [`--dashboard-${mode.key}-segmented-control-active-text`, theme[mode.key].segmentedControlActiveText],
      [`--dashboard-${mode.key}-segmented-control-background`, theme[mode.key].segmentedControlBackground],
      [`--dashboard-${mode.key}-segmented-control-border`, theme[mode.key].segmentedControlBorder],
      [`--dashboard-${mode.key}-segmented-control-text`, theme[mode.key].segmentedControlText],
      [`--dashboard-${mode.key}-overlay-background`, theme[mode.key].overlayBackground],
      [`--dashboard-${mode.key}-placeholder`, theme[mode.key].placeholder],
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
      [`--dashboard-${mode.key}-toast-info-background`, theme[mode.key].toastInfoBackground],
      [`--dashboard-${mode.key}-toast-info-border`, theme[mode.key].toastInfoBorder],
      [`--dashboard-${mode.key}-toast-info-text`, theme[mode.key].toastInfoText],
      [`--dashboard-${mode.key}-toast-success-background`, theme[mode.key].toastSuccessBackground],
      [`--dashboard-${mode.key}-toast-success-border`, theme[mode.key].toastSuccessBorder],
      [`--dashboard-${mode.key}-toast-success-text`, theme[mode.key].toastSuccessText]
    ])
  );
}
