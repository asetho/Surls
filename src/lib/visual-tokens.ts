export type VisualSystemToken = {
  category: string;
  cssCustomProperty?: `--${string}`;
  description: string;
  exampleUsage: string;
  id: string;
  label: string;
  scope: "admin-shell" | "global" | "responsive";
  status: "read-only" | "derived";
  value: string;
  valueType: "breakpoint" | "duration" | "easing" | "radius" | "shadow" | "size" | "spacing" | "type" | "z-index";
};

export const STRUCTURAL_VISUAL_TOKEN_REGISTRY: readonly VisualSystemToken[] = [
  {
    category: "Typography",
    description: "Primary display heading size used on admin page headers.",
    exampleUsage: "Admin h1 and top-level page headings.",
    id: "type.display",
    label: "Display text",
    scope: "admin-shell",
    status: "read-only",
    value: "clamp(1.8rem, 3vw, 2.55rem)",
    valueType: "type"
  },
  {
    category: "Typography",
    description: "Default compact interface text size.",
    exampleUsage: "Body copy, form labels, and table rows.",
    id: "type.body",
    label: "Body text",
    scope: "global",
    status: "read-only",
    value: "0.95rem",
    valueType: "type"
  },
  {
    category: "Typography",
    description: "Secondary metadata and helper text size.",
    exampleUsage: "Timestamps, helper copy, sort badges, and table metadata.",
    id: "type.small",
    label: "Small text",
    scope: "admin-shell",
    status: "read-only",
    value: "0.78rem",
    valueType: "type"
  },
  {
    category: "Spacing",
    description: "Default spacing between related controls.",
    exampleUsage: "Row actions, filter forms, and toolbar controls.",
    id: "space.control-gap",
    label: "Control gap",
    scope: "admin-shell",
    status: "read-only",
    value: "0.45rem",
    valueType: "spacing"
  },
  {
    category: "Spacing",
    description: "Default spacing inside panels and form stacks.",
    exampleUsage: "Surface panels, settings cards, and tools panes.",
    id: "space.panel-gap",
    label: "Panel gap",
    scope: "admin-shell",
    status: "read-only",
    value: "0.75rem",
    valueType: "spacing"
  },
  {
    category: "Spacing",
    cssCustomProperty: "--control-padding-x",
    description: "Horizontal padding used by standard controls.",
    exampleUsage: "Inputs, select boxes, and full-size buttons.",
    id: "space.control-x",
    label: "Control horizontal padding",
    scope: "global",
    status: "derived",
    value: "0.8rem",
    valueType: "spacing"
  },
  {
    category: "Spacing",
    cssCustomProperty: "--control-padding-y",
    description: "Vertical padding used by standard controls.",
    exampleUsage: "Inputs, select boxes, and full-size buttons.",
    id: "space.control-y",
    label: "Control vertical padding",
    scope: "global",
    status: "derived",
    value: "0.56rem",
    valueType: "spacing"
  },
  {
    category: "Radius",
    cssCustomProperty: "--radius",
    description: "Default compact corner radius.",
    exampleUsage: "Buttons, inputs, cards, modals, and table cards.",
    id: "radius.default",
    label: "Default radius",
    scope: "global",
    status: "derived",
    value: "8px",
    valueType: "radius"
  },
  {
    category: "Radius",
    description: "Small radius used for dense badges and short URL pills.",
    exampleUsage: "Sort badges, tag pills, and compact metadata.",
    id: "radius.small",
    label: "Small radius",
    scope: "admin-shell",
    status: "read-only",
    value: "5px",
    valueType: "radius"
  },
  {
    category: "Controls",
    cssCustomProperty: "--control-height",
    description: "Compact form control height used by the admin interface.",
    exampleUsage: "Inputs, selects, and primary action buttons.",
    id: "control.height",
    label: "Control height",
    scope: "global",
    status: "derived",
    value: "2.12rem",
    valueType: "size"
  },
  {
    category: "Controls",
    cssCustomProperty: "--data-table-action-size",
    description: "Dense table icon action target; expands to 44px on mobile.",
    exampleUsage: "Copy, share, edit, QR, and delete controls in table rows.",
    id: "control.icon-action",
    label: "Icon action size",
    scope: "admin-shell",
    status: "read-only",
    value: "34px",
    valueType: "size"
  },
  {
    category: "Tables",
    description: "Standard dense table row vertical padding.",
    exampleUsage: "Links, users, API tokens, dashboard links, and recent clicks.",
    id: "table.row-padding-y",
    label: "Dense row padding",
    scope: "admin-shell",
    status: "read-only",
    value: "0.46rem",
    valueType: "spacing"
  },
  {
    category: "Tables",
    description: "Minimum width at which table layouts stay tabular before mobile cards.",
    exampleUsage: "Responsive admin data tables.",
    id: "table.min-width",
    label: "Table minimum width",
    scope: "responsive",
    status: "read-only",
    value: "780px",
    valueType: "size"
  },
  {
    category: "Shadows",
    cssCustomProperty: "--shadow",
    description: "Panel and tooltip elevation.",
    exampleUsage: "Surfaces, modal panels, chart tooltips, and popovers.",
    id: "shadow.panel",
    label: "Panel shadow",
    scope: "global",
    status: "derived",
    value: "theme-derived panel shadow",
    valueType: "shadow"
  },
  {
    category: "Motion",
    description: "Default micro-interaction duration.",
    exampleUsage: "Hover, disclosure, tab, toast, and drawer transitions.",
    id: "motion.fast",
    label: "Fast duration",
    scope: "global",
    status: "read-only",
    value: "120-180ms",
    valueType: "duration"
  },
  {
    category: "Motion",
    description: "Default easing curve for small UI state changes.",
    exampleUsage: "Theme drawer, tab state, and tooltip transitions.",
    id: "motion.ease",
    label: "Default easing",
    scope: "global",
    status: "read-only",
    value: "ease",
    valueType: "easing"
  },
  {
    category: "Layers",
    description: "Standard above-content layer for sticky controls and transient UI.",
    exampleUsage: "Sticky headers, tooltips, and chart hover markers.",
    id: "z.transient",
    label: "Transient layer",
    scope: "admin-shell",
    status: "read-only",
    value: "20-50",
    valueType: "z-index"
  },
  {
    category: "Layers",
    description: "Modal and drawer overlay layer.",
    exampleUsage: "Dialogs, theme editor drawer, and blocking overlays.",
    id: "z.overlay",
    label: "Overlay layer",
    scope: "admin-shell",
    status: "read-only",
    value: "100-120",
    valueType: "z-index"
  },
  {
    category: "Breakpoints",
    description: "Mobile card-table breakpoint.",
    exampleUsage: "Responsive tables, admin headers, forms, and action stacks.",
    id: "breakpoint.mobile",
    label: "Mobile breakpoint",
    scope: "responsive",
    status: "read-only",
    value: "700px",
    valueType: "breakpoint"
  },
  {
    category: "Breakpoints",
    description: "Narrow admin layout breakpoint.",
    exampleUsage: "Sidebar, topbar, dashboard grids, and settings layouts.",
    id: "breakpoint.admin",
    label: "Admin breakpoint",
    scope: "responsive",
    status: "read-only",
    value: "900px",
    valueType: "breakpoint"
  }
] as const;

export const STRUCTURAL_VISUAL_TOKEN_CATEGORIES = Array.from(
  new Set(STRUCTURAL_VISUAL_TOKEN_REGISTRY.map((token) => token.category))
).map((category) => ({
  category,
  tokens: STRUCTURAL_VISUAL_TOKEN_REGISTRY.filter((token) => token.category === category)
}));
