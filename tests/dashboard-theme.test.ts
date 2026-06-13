import { describe, expect, it } from "vitest";
import {
  DASHBOARD_THEME_FIELDS,
  DASHBOARD_THEME_MODES,
  DEFAULT_DASHBOARD_THEME,
  dashboardThemeCssVariables,
  dashboardThemeFieldName,
  dashboardThemeFromFormData,
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
        sidebar: DEFAULT_DASHBOARD_THEME.light.sidebar,
        text: DEFAULT_DASHBOARD_THEME.light.text
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
      "--dashboard-dark-accent": DEFAULT_DASHBOARD_THEME.dark.accent,
      "--dashboard-light-surface": DEFAULT_DASHBOARD_THEME.light.surface,
      "--dashboard-light-text": DEFAULT_DASHBOARD_THEME.light.text
    });
  });
});
