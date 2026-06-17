import type { DashboardThemeKey, DashboardThemeMode } from "@/lib/dashboard-theme";

export const DASHBOARD_THEME_EDITOR_FOCUS_EVENT = "surls-dashboard-theme-editor-focus";

export type DashboardThemeEditorFocusDetail = {
  field: DashboardThemeKey;
  mode?: DashboardThemeMode;
};
