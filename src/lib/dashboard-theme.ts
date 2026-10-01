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
  chartPiePrimary: string;
  chartPieSecondary: string;
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
  { key: "chartPiePrimary", label: "Pie primary", description: "First and strongest pie slice color." },
  { key: "chartPieSecondary", label: "Pie secondary", description: "End color used to derive the remaining pie slices." },
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
    accent: "#055c83",
    activePillBackground: "#e6f2f8",
    activePillBorder: "#79bdd7",
    activePillText: "#015a85",
    background: "#f2f5f7",
    border: "#b9d5e4",
    buttonText: "#ffffff",
    chartAccent: "#acd7ee",
    chartDanger: "#c81d25",
    chartMapHigh: "#055c83",
    chartMapLow: "#e6f2f8",
    chartPiePrimary: "#055c83",
    chartPieSecondary: "#ffffff",
    chartPrimary: "#055c83",
    chartSecondary: "#0488a5",
    dangerBackground: "#c81d25",
    dangerBorder: "#c81d25",
    dangerText: "#ffffff",
    focusRing: "#055c83",
    link: "#055c83",
    muted: "#476778",
    pillBackground: "#e6f2f8",
    pillBorder: "#b9d5e4",
    pillText: "#082b3d",
    qrBackground: "#ffffff",
    segmentedControlActiveBackground: "#055c83",
    segmentedControlActiveText: "#ffffff",
    segmentedControlBackground: "#e6f2f8",
    segmentedControlBorder: "#79bdd7",
    segmentedControlText: "#476778",
    shortUrlPillAccent: "#0488a5",
    shortUrlPillBackground: "#e6f2f8",
    shortUrlPillBorder: "#79bdd7",
    shortUrlPillText: "#015a85",
    sidebar: "#015a85",
    sidebarBorder: "#79bdd7",
    sidebarHover: "#036d8f",
    sidebarMuted: "#acd7ee",
    sidebarText: "#ffffff",
    statsTabActiveBackground: "#055c83",
    statsTabActiveBorder: "#055c83",
    statsTabActiveText: "#ffffff",
    statsTabBackground: "#e6f2f8",
    statsTabBorder: "#79bdd7",
    statsTabListBackground: "#e6f2f8",
    statsTabText: "#476778",
    surface: "#ffffff",
    surfaceStrong: "#e6f2f8",
    text: "#082b3d",
    overlayBackground: "#082b3d",
    placeholder: "#5a7583",
    shadowColor: "#015a85",
    toastErrorBackground: "#ffffff",
    toastErrorBorder: "#c81d25",
    toastErrorText: "#082b3d",
    toastInfoBackground: "#e6f2f8",
    toastInfoBorder: "#b9d5e4",
    toastInfoText: "#082b3d",
    toastSuccessBackground: "#ffffff",
    toastSuccessBorder: "#0488a5",
    toastSuccessText: "#082b3d"
  },
  dark: {
    accent: "#79bdd7",
    activePillBackground: "#79bdd7",
    activePillBorder: "#acd7ee",
    activePillText: "#061d2b",
    background: "#061d2b",
    border: "#3d7e9b",
    buttonText: "#061d2b",
    chartAccent: "#10485f",
    chartDanger: "#e65057",
    chartMapHigh: "#79bdd7",
    chartMapLow: "#10485f",
    chartPiePrimary: "#79bdd7",
    chartPieSecondary: "#10485f",
    chartPrimary: "#79bdd7",
    chartSecondary: "#0488a5",
    dangerBackground: "#f06369",
    dangerBorder: "#ff858a",
    dangerText: "#061d2b",
    focusRing: "#79bdd7",
    link: "#acd7ee",
    muted: "#b6d0dc",
    pillBackground: "#10485f",
    pillBorder: "#3d7e9b",
    pillText: "#f5f9fb",
    qrBackground: "#ffffff",
    segmentedControlActiveBackground: "#79bdd7",
    segmentedControlActiveText: "#061d2b",
    segmentedControlBackground: "#10485f",
    segmentedControlBorder: "#3d7e9b",
    segmentedControlText: "#b6d0dc",
    shortUrlPillAccent: "#79bdd7",
    shortUrlPillBackground: "#10485f",
    shortUrlPillBorder: "#3d7e9b",
    shortUrlPillText: "#f5f9fb",
    sidebar: "#082b3d",
    sidebarBorder: "#3d7e9b",
    sidebarHover: "#015a85",
    sidebarMuted: "#acd7ee",
    sidebarText: "#f5f9fb",
    statsTabActiveBackground: "#79bdd7",
    statsTabActiveBorder: "#79bdd7",
    statsTabActiveText: "#061d2b",
    statsTabBackground: "#10485f",
    statsTabBorder: "#3d7e9b",
    statsTabListBackground: "#10485f",
    statsTabText: "#b6d0dc",
    surface: "#0c354b",
    surfaceStrong: "#10485f",
    text: "#f5f9fb",
    overlayBackground: "#000000",
    placeholder: "#b6d0dc",
    shadowColor: "#000000",
    toastErrorBackground: "#0c354b",
    toastErrorBorder: "#ff858a",
    toastErrorText: "#f5f9fb",
    toastInfoBackground: "#10485f",
    toastInfoBorder: "#3d7e9b",
    toastInfoText: "#f5f9fb",
    toastSuccessBackground: "#0c354b",
    toastSuccessBorder: "#79bdd7",
    toastSuccessText: "#f5f9fb"
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
  const palette = Object.fromEntries(
    DASHBOARD_THEME_FIELDS.map((field) => {
      const storedColor = value[field.key];
      const color = typeof storedColor === "string" ? expandHexColor(storedColor) : null;
      return [field.key, color ?? fallback[field.key]];
    })
  ) as DashboardThemePalette;

  if (!expandHexColor(typeof value.chartPiePrimary === "string" ? value.chartPiePrimary : "")) {
    palette.chartPiePrimary = palette.chartPrimary;
  }
  if (!expandHexColor(typeof value.chartPieSecondary === "string" ? value.chartPieSecondary : "")) {
    palette.chartPieSecondary = palette.surface;
  }

  return palette;
}

function isFlatDashboardTheme(value: unknown) {
  return isRecord(value) && DASHBOARD_THEME_FIELDS.some((field) => typeof value[field.key] === "string");
}

function updateLegacyDefaultDarkDanger(palette: DashboardThemePalette): DashboardThemePalette {
  const defaults = DEFAULT_DASHBOARD_THEME.dark;
  const legacyDanger =
    palette.dangerBackground === defaults.chartDanger &&
    palette.dangerBorder === defaults.dangerBorder &&
    palette.dangerText === DEFAULT_DASHBOARD_THEME.light.dangerText;
  const otherwiseBuiltIn = DASHBOARD_THEME_FIELDS.every((field) =>
    field.key === "dangerBackground" || field.key === "dangerText" || palette[field.key] === defaults[field.key]
  );

  return legacyDanger && otherwiseBuiltIn
    ? { ...palette, dangerBackground: defaults.dangerBackground, dangerText: defaults.dangerText }
    : palette;
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
    dark: updateLegacyDefaultDarkDanger(normalizeDashboardThemePalette(value.dark, DEFAULT_DASHBOARD_THEME.dark))
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
    "--chart-pie-slice-1": theme.chartPiePrimary,
    "--chart-pie-slice-2": `color-mix(in srgb, ${theme.chartPiePrimary}, ${theme.chartPieSecondary} 32%)`,
    "--chart-pie-slice-3": `color-mix(in srgb, ${theme.chartPiePrimary}, ${theme.chartPieSecondary} 58%)`,
    "--chart-pie-slice-4": `color-mix(in srgb, ${theme.chartPiePrimary}, ${theme.chartPieSecondary} 72%)`,
    "--chart-pie-slice-5": `color-mix(in srgb, ${theme.chartPiePrimary}, ${theme.chartPieSecondary} 86%)`,
    "--chart-pie-slice-6": theme.chartPieSecondary,
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
      [`--dashboard-${mode.key}-chart-pie-primary`, theme[mode.key].chartPiePrimary],
      [`--dashboard-${mode.key}-chart-pie-secondary`, theme[mode.key].chartPieSecondary],
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
