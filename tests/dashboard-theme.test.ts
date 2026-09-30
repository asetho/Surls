import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DASHBOARD_THEME_EDITABLE_FIELDS,
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

function expectedFocusRing(palette: typeof DEFAULT_DASHBOARD_THEME.light) {
  return `0 0 0 2px color-mix(in srgb, ${palette.buttonText}, transparent 14%), 0 0 0 4px color-mix(in srgb, ${palette.accent}, ${palette.text} 30%)`;
}

describe("dashboard theme settings", () => {
  it("updates only the saved built-in dark danger colors", () => {
    const legacyDark = {
      ...DEFAULT_DASHBOARD_THEME.dark,
      dangerBackground: DEFAULT_DASHBOARD_THEME.dark.chartDanger,
      dangerText: DEFAULT_DASHBOARD_THEME.light.dangerText
    };

    expect(normalizeDashboardTheme({ light: DEFAULT_DASHBOARD_THEME.light, dark: legacyDark }).dark).toEqual(
      DEFAULT_DASHBOARD_THEME.dark
    );
    expect(normalizeDashboardTheme({
      light: DEFAULT_DASHBOARD_THEME.light,
      dark: { ...legacyDark, accent: DEFAULT_DASHBOARD_THEME.dark.link }
    }).dark).toMatchObject({ ...legacyDark, accent: DEFAULT_DASHBOARD_THEME.dark.link });
  });

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
        chartPiePrimary: DEFAULT_DASHBOARD_THEME.light.chartPrimary,
        chartPieSecondary: DEFAULT_DASHBOARD_THEME.light.surface,
        chartPrimary: DEFAULT_DASHBOARD_THEME.light.chartPrimary,
        dangerBackground: DEFAULT_DASHBOARD_THEME.light.dangerBackground,
        focusRing: DEFAULT_DASHBOARD_THEME.light.focusRing,
        link: DEFAULT_DASHBOARD_THEME.light.link,
        overlayBackground: DEFAULT_DASHBOARD_THEME.light.overlayBackground,
        placeholder: DEFAULT_DASHBOARD_THEME.light.placeholder,
        pillBackground: DEFAULT_DASHBOARD_THEME.light.pillBackground,
        qrBackground: DEFAULT_DASHBOARD_THEME.light.qrBackground,
        shadowColor: DEFAULT_DASHBOARD_THEME.light.shadowColor,
        sidebar: DEFAULT_DASHBOARD_THEME.light.sidebar,
        sidebarText: DEFAULT_DASHBOARD_THEME.light.sidebarText,
        shortUrlPillAccent: DEFAULT_DASHBOARD_THEME.light.shortUrlPillAccent,
        text: DEFAULT_DASHBOARD_THEME.light.text,
        toastInfoBackground: DEFAULT_DASHBOARD_THEME.light.toastInfoBackground,
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

  it("derives missing pie colors from existing custom chart and surface colors", () => {
    expect(
      normalizeDashboardTheme({
        light: { chartPrimary: "#123456", surface: "#abcdef" },
        dark: { chartPrimary: "#654321", surface: "#fedcba" }
      })
    ).toMatchObject({
      light: { chartPiePrimary: "#123456", chartPieSecondary: "#abcdef" },
      dark: { chartPiePrimary: "#654321", chartPieSecondary: "#fedcba" }
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
    const expectedFieldCount = DASHBOARD_THEME_MODES.length * DASHBOARD_THEME_EDITABLE_FIELDS.length;

    expect(Array.from(formData.keys())).toHaveLength(expectedFieldCount);
    expect(Array.from(formData.keys()).some((key) => key.endsWith("[focusRing]"))).toBe(false);
    expect(DASHBOARD_THEME_EDITABLE_FIELDS.some((field) => String(field.key).startsWith("statsTab"))).toBe(false);
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
      "--dashboard-light-chart-pie-primary": DEFAULT_DASHBOARD_THEME.light.chartPiePrimary,
      "--dashboard-light-chart-pie-secondary": DEFAULT_DASHBOARD_THEME.light.chartPieSecondary,
      "--dashboard-light-danger-background": DEFAULT_DASHBOARD_THEME.light.dangerBackground,
      "--dashboard-light-focus-ring": expectedFocusRing({ ...DEFAULT_DASHBOARD_THEME.light, accent: "#112233" }),
      "--dashboard-light-link": DEFAULT_DASHBOARD_THEME.light.link,
      "--dashboard-light-overlay-background": DEFAULT_DASHBOARD_THEME.light.overlayBackground,
      "--dashboard-light-placeholder": DEFAULT_DASHBOARD_THEME.light.placeholder,
      "--dashboard-dark-accent": DEFAULT_DASHBOARD_THEME.dark.accent,
      "--dashboard-dark-short-url-pill-accent": DEFAULT_DASHBOARD_THEME.dark.shortUrlPillAccent,
      "--dashboard-light-pill-background": DEFAULT_DASHBOARD_THEME.light.pillBackground,
      "--dashboard-light-qr-background": DEFAULT_DASHBOARD_THEME.light.qrBackground,
      "--dashboard-light-shadow": `0 18px 50px ${DEFAULT_DASHBOARD_THEME.light.shadowColor}1f`,
      "--dashboard-light-sidebar-text": DEFAULT_DASHBOARD_THEME.light.sidebarText,
      "--dashboard-light-stats-tab-active-background": DEFAULT_DASHBOARD_THEME.light.statsTabActiveBackground,
      "--dashboard-light-stats-tab-active-text": DEFAULT_DASHBOARD_THEME.light.statsTabActiveText,
      "--dashboard-light-stats-tab-background": DEFAULT_DASHBOARD_THEME.light.statsTabBackground,
      "--dashboard-light-stats-tab-text": DEFAULT_DASHBOARD_THEME.light.statsTabText,
      "--dashboard-light-surface": DEFAULT_DASHBOARD_THEME.light.surface,
      "--dashboard-light-text": DEFAULT_DASHBOARD_THEME.light.text,
      "--dashboard-light-toast-info-background": DEFAULT_DASHBOARD_THEME.light.toastInfoBackground,
      "--dashboard-light-toast-success-background": DEFAULT_DASHBOARD_THEME.light.toastSuccessBackground,
      "--dashboard-dark-toast-error-border": DEFAULT_DASHBOARD_THEME.dark.toastErrorBorder
    });
  });

  it("maps a single palette to chart and warning preview variables", () => {
    expect(dashboardThemePaletteCssVariables(DEFAULT_DASHBOARD_THEME.light)).toMatchObject({
      "--chart-color-1": DEFAULT_DASHBOARD_THEME.light.chartPrimary,
      "--chart-color-5": DEFAULT_DASHBOARD_THEME.light.chartDanger,
      "--chart-pie-slice-1": DEFAULT_DASHBOARD_THEME.light.chartPiePrimary,
      "--chart-pie-slice-6": DEFAULT_DASHBOARD_THEME.light.chartPieSecondary,
      "--chart-map-bucket-1": DEFAULT_DASHBOARD_THEME.light.chartMapLow,
      "--chart-map-bucket-5": DEFAULT_DASHBOARD_THEME.light.chartMapHigh,
      "--chart-tooltip-background": DEFAULT_DASHBOARD_THEME.light.surface,
      "--danger-background": DEFAULT_DASHBOARD_THEME.light.dangerBackground,
      "--focus-ring": expectedFocusRing(DEFAULT_DASHBOARD_THEME.light),
      "--link-color": DEFAULT_DASHBOARD_THEME.light.link,
      "--overlay-background": DEFAULT_DASHBOARD_THEME.light.overlayBackground,
      "--placeholder": DEFAULT_DASHBOARD_THEME.light.placeholder,
      "--qr-background": DEFAULT_DASHBOARD_THEME.light.qrBackground,
      "--shadow": `0 18px 50px ${DEFAULT_DASHBOARD_THEME.light.shadowColor}1f`,
      "--sidebar-text": DEFAULT_DASHBOARD_THEME.light.sidebarText,
      "--short-url-pill-background": DEFAULT_DASHBOARD_THEME.light.shortUrlPillBackground,
      "--stats-tab-active-background": DEFAULT_DASHBOARD_THEME.light.statsTabActiveBackground,
      "--stats-tab-active-text": DEFAULT_DASHBOARD_THEME.light.statsTabActiveText,
      "--stats-tab-background": DEFAULT_DASHBOARD_THEME.light.statsTabBackground,
      "--stats-tab-list-background": DEFAULT_DASHBOARD_THEME.light.statsTabListBackground,
      "--stats-tab-text": DEFAULT_DASHBOARD_THEME.light.statsTabText,
      "--toast-error-border": DEFAULT_DASHBOARD_THEME.light.toastErrorBorder,
      "--toast-info-background": DEFAULT_DASHBOARD_THEME.light.toastInfoBackground,
      "--toast-success-background": DEFAULT_DASHBOARD_THEME.light.toastSuccessBackground
    });
  });

  it("keeps graph tab colors independent from QR segmented controls", () => {
    expect(
      dashboardThemePaletteCssVariables({
        ...DEFAULT_DASHBOARD_THEME.light,
        segmentedControlActiveBackground: "#111111",
        segmentedControlActiveText: "#222222",
        segmentedControlBackground: "#333333",
        segmentedControlBorder: "#444444",
        segmentedControlText: "#555555",
        statsTabActiveBackground: "#aa1111",
        statsTabActiveBorder: "#bb2222",
        statsTabActiveText: "#cc3333",
        statsTabBackground: "#dd4444",
        statsTabBorder: "#ee5555",
        statsTabListBackground: "#aa6666",
        statsTabText: "#bb7777"
      })
    ).toMatchObject({
      "--segmented-control-active-background": "#111111",
      "--segmented-control-active-text": "#222222",
      "--segmented-control-background": "#333333",
      "--segmented-control-border": "#444444",
      "--segmented-control-text": "#555555",
      "--stats-tab-active-background": "#aa1111",
      "--stats-tab-active-border": "#bb2222",
      "--stats-tab-active-text": "#cc3333",
      "--stats-tab-background": "#dd4444",
      "--stats-tab-border": "#ee5555",
      "--stats-tab-list-background": "#aa6666",
      "--stats-tab-text": "#bb7777"
    });
  });

  it("lets segmented controls use their theme text colors instead of primary button text", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

    expect(css).toContain(":not(.segmented-control-option)");
    expect(css).toMatch(/\.segmented-control button\s*{[\s\S]*color:\s*var\(--segmented-control-text/);
    expect(css).toMatch(
      /\.segmented-control button\[aria-pressed="true"\]\s*{[\s\S]*color:\s*var\(--segmented-control-active-text/
    );
  });
});
