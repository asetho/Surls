import { describe, expect, it } from "vitest";
import {
  DASHBOARD_THEME_FIELDS,
  DASHBOARD_THEME_MODES,
  DEFAULT_DASHBOARD_THEME,
  dashboardThemeCssVariables,
  dashboardThemeFieldName,
  dashboardThemeFromFormData,
  dashboardThemePaletteCssVariables,
  dashboardThemeToFormData,
  isDefaultDashboardTheme,
  normalizeDashboardTheme
} from "@/lib/dashboard-theme";

function dashboardThemeForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  for (const mode of DASHBOARD_THEME_MODES) {
    for (const field of DASHBOARD_THEME_FIELDS) {
      const overrideKey = `${mode.key}.${field.key}`;
      formData.set(
        dashboardThemeFieldName(mode.key, field.key),
        overrides[overrideKey] ?? DEFAULT_DASHBOARD_THEME[mode.key][field.key]
      );
    }
  }
  return formData;
}

describe("dashboard theme settings", () => {
  it("normalizes stored theme colors and fills missing values from defaults", () => {
    expect(
      normalizeDashboardTheme({
        light: {
          accent: "#abc",
          background: "#123456",
          sidebar: "not-a-color"
        },
        dark: {
          accent: "#def"
        }
      })
    ).toMatchObject({
      light: {
        accent: "#aabbcc",
        background: "#123456",
        chartPrimary: DEFAULT_DASHBOARD_THEME.light.chartPrimary,
        dangerBackground: DEFAULT_DASHBOARD_THEME.light.dangerBackground,
        focusRing: DEFAULT_DASHBOARD_THEME.light.focusRing,
        link: DEFAULT_DASHBOARD_THEME.light.link,
        overlayBackground: DEFAULT_DASHBOARD_THEME.light.overlayBackground,
        pillBackground: DEFAULT_DASHBOARD_THEME.light.pillBackground,
        qrBackground: DEFAULT_DASHBOARD_THEME.light.qrBackground,
        shadowColor: DEFAULT_DASHBOARD_THEME.light.shadowColor,
        sidebar: DEFAULT_DASHBOARD_THEME.light.sidebar,
        sidebarText: DEFAULT_DASHBOARD_THEME.light.sidebarText,
        shortUrlPillAccent: DEFAULT_DASHBOARD_THEME.light.shortUrlPillAccent,
        text: DEFAULT_DASHBOARD_THEME.light.text,
        toastSuccessBackground: DEFAULT_DASHBOARD_THEME.light.toastSuccessBackground
      },
      dark: {
        accent: "#ddeeff",
        background: DEFAULT_DASHBOARD_THEME.dark.background
      }
    });
  });

  it("reads old single-palette settings as the light palette", () => {
    expect(normalizeDashboardTheme({ accent: "#abc", background: "#123456" })).toMatchObject({
      light: {
        accent: "#aabbcc",
        background: "#123456"
      },
      dark: DEFAULT_DASHBOARD_THEME.dark
    });
  });

  it("requires valid hex colors from settings forms", () => {
    expect(dashboardThemeFromFormData(dashboardThemeForm({ "dark.accent": "#ABCDEF" }))).toMatchObject({
      dark: {
        accent: "#abcdef"
      }
    });

    expect(() =>
      dashboardThemeFromFormData(dashboardThemeForm({ "light.accent": "url(javascript:alert(1))" }))
    ).toThrow(
      /Light mode accent must be a valid hex color/
    );
  });

  it("serializes every palette color for client-side theme editor saves", () => {
    const formData = dashboardThemeToFormData(DEFAULT_DASHBOARD_THEME);
    const expectedFieldCount = DASHBOARD_THEME_MODES.length * DASHBOARD_THEME_FIELDS.length;

    expect(Array.from(formData.keys())).toHaveLength(expectedFieldCount);
    expect(dashboardThemeFromFormData(formData)).toEqual(DEFAULT_DASHBOARD_THEME);
  });

  it("identifies the built-in palette", () => {
    expect(isDefaultDashboardTheme(DEFAULT_DASHBOARD_THEME)).toBe(true);
    expect(
      isDefaultDashboardTheme({
        ...DEFAULT_DASHBOARD_THEME,
        dark: { ...DEFAULT_DASHBOARD_THEME.dark, accent: "#000000" }
      })
    ).toBe(false);
  });

  it("maps theme colors to scoped dashboard CSS variables", () => {
    expect(
      dashboardThemeCssVariables({
        ...DEFAULT_DASHBOARD_THEME,
        light: { ...DEFAULT_DASHBOARD_THEME.light, accent: "#112233" }
      })
    ).toMatchObject({
      "--dashboard-light-accent": "#112233",
      "--dashboard-light-active-pill-background": DEFAULT_DASHBOARD_THEME.light.activePillBackground,
      "--dashboard-light-chart-primary": DEFAULT_DASHBOARD_THEME.light.chartPrimary,
      "--dashboard-light-chart-map-high": DEFAULT_DASHBOARD_THEME.light.chartMapHigh,
      "--dashboard-light-danger-background": DEFAULT_DASHBOARD_THEME.light.dangerBackground,
      "--dashboard-light-focus-ring": `0 0 0 3px ${DEFAULT_DASHBOARD_THEME.light.focusRing}55`,
      "--dashboard-light-link": DEFAULT_DASHBOARD_THEME.light.link,
      "--dashboard-light-overlay-background": DEFAULT_DASHBOARD_THEME.light.overlayBackground,
      "--dashboard-dark-accent": DEFAULT_DASHBOARD_THEME.dark.accent,
      "--dashboard-dark-short-url-pill-accent": DEFAULT_DASHBOARD_THEME.dark.shortUrlPillAccent,
      "--dashboard-light-pill-background": DEFAULT_DASHBOARD_THEME.light.pillBackground,
      "--dashboard-light-qr-background": DEFAULT_DASHBOARD_THEME.light.qrBackground,
      "--dashboard-light-shadow": `0 18px 50px ${DEFAULT_DASHBOARD_THEME.light.shadowColor}1f`,
      "--dashboard-light-shadow-color": DEFAULT_DASHBOARD_THEME.light.shadowColor,
      "--dashboard-light-sidebar-text": DEFAULT_DASHBOARD_THEME.light.sidebarText,
      "--dashboard-light-surface": DEFAULT_DASHBOARD_THEME.light.surface,
      "--dashboard-light-text": DEFAULT_DASHBOARD_THEME.light.text,
      "--dashboard-light-toast-success-background": DEFAULT_DASHBOARD_THEME.light.toastSuccessBackground,
      "--dashboard-dark-toast-error-border": DEFAULT_DASHBOARD_THEME.dark.toastErrorBorder
    });
  });

  it("maps a single palette to chart and warning preview variables", () => {
    expect(dashboardThemePaletteCssVariables(DEFAULT_DASHBOARD_THEME.light)).toMatchObject({
      "--chart-color-1": DEFAULT_DASHBOARD_THEME.light.chartPrimary,
      "--chart-color-5": DEFAULT_DASHBOARD_THEME.light.chartDanger,
      "--chart-map-bucket-1": DEFAULT_DASHBOARD_THEME.light.chartMapLow,
      "--chart-map-bucket-5": DEFAULT_DASHBOARD_THEME.light.chartMapHigh,
      "--chart-tooltip-background": DEFAULT_DASHBOARD_THEME.light.surface,
      "--danger-background": DEFAULT_DASHBOARD_THEME.light.dangerBackground,
      "--focus-ring": `0 0 0 3px ${DEFAULT_DASHBOARD_THEME.light.focusRing}55`,
      "--link-color": DEFAULT_DASHBOARD_THEME.light.link,
      "--overlay-background": DEFAULT_DASHBOARD_THEME.light.overlayBackground,
      "--qr-background": DEFAULT_DASHBOARD_THEME.light.qrBackground,
      "--shadow": `0 18px 50px ${DEFAULT_DASHBOARD_THEME.light.shadowColor}1f`,
      "--sidebar-text": DEFAULT_DASHBOARD_THEME.light.sidebarText,
      "--short-url-pill-background": DEFAULT_DASHBOARD_THEME.light.shortUrlPillBackground,
      "--toast-error-border": DEFAULT_DASHBOARD_THEME.light.toastErrorBorder,
      "--toast-success-background": DEFAULT_DASHBOARD_THEME.light.toastSuccessBackground
    });
  });
});
