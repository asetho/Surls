import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DASHBOARD_THEME_EDITABLE_FIELDS,
  DASHBOARD_THEME_FIELDS,
  DASHBOARD_THEME_TOKEN_REGISTRY,
  dashboardThemeCssVariables,
  DEFAULT_DASHBOARD_THEME
} from "@/lib/dashboard-theme";
import hardcodedExceptions from "../docs/audits/css-hardcoded-exceptions.json";

function walkSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walkSourceFiles(path);
    return /\.(css|ts|tsx)$/.test(path) ? [path] : [];
  });
}

function visualLiteralCounts(file: string) {
  const text = readFileSync(file, "utf8");
  return {
    colorLiterals: (text.match(/#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^\)]*\)|hsla?\([^\)]*\)|color-mix\([^;{}]*\)/g) ?? []).length,
    importantDeclarations: (text.match(/!important/g) ?? []).length,
    inlineStyleAttributes: (text.match(/style=\{\{/g) ?? []).length
  };
}

describe("theme token coverage", () => {
  it("documents every dashboard theme field in the canonical registry", () => {
    const fieldKeys = DASHBOARD_THEME_FIELDS.map((field) => field.key).sort();
    const registryKeys = DASHBOARD_THEME_TOKEN_REGISTRY.map((token) => token.key).sort();
    const editableKeys = DASHBOARD_THEME_EDITABLE_FIELDS.map((field) => field.key).sort();
    const editableRegistryKeys = DASHBOARD_THEME_TOKEN_REGISTRY.filter((token) => token.editable)
      .map((token) => token.key)
      .sort();

    expect(registryKeys).toEqual(fieldKeys);
    expect(editableRegistryKeys).toEqual(editableKeys);
  });

  it("keeps emitted dashboard CSS variables represented in the token registry", () => {
    const emittedVariables = Object.keys(dashboardThemeCssVariables(DEFAULT_DASHBOARD_THEME));
    const emittedPaletteVariables = emittedVariables.filter((name) => name.startsWith("--dashboard-light-"));
    const registryLightVariables = new Set(
      DASHBOARD_THEME_TOKEN_REGISTRY.map((token) =>
        token.cssCustomProperty.replace("--dashboard-active-", "--dashboard-light-")
      )
    );

    for (const variable of emittedPaletteVariables) {
      if (variable === "--dashboard-light-shadow") continue;
      expect(registryLightVariables.has(variable), `${variable} missing from registry`).toBe(true);
    }
  });

  it("keeps active dashboard CSS custom properties documented in the registry", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const activeVariables = Array.from(css.matchAll(/(--dashboard-active-[\w-]+)\s*:/g), (match) => match[1]);
    const registryVariables: Set<string> = new Set(DASHBOARD_THEME_TOKEN_REGISTRY.map((token) => token.cssCustomProperty));

    for (const variable of new Set(activeVariables)) {
      if (variable === "--dashboard-active-shadow") continue;
      expect(registryVariables.has(variable), `${variable} missing from registry`).toBe(true);
    }
  });

  it("renders registry tokens from both the theme editor and style reference", () => {
    const editor = readFileSync("src/components/DashboardThemeEditor.tsx", "utf8");
    const styleReference = readFileSync("src/app/admin/style-reference/page.tsx", "utf8");

    expect(editor).toContain("DASHBOARD_THEME_TOKEN_REGISTRY");
    expect(styleReference).toContain("DASHBOARD_THEME_TOKEN_REGISTRY");
  });

  it("keeps hard-coded visual values inside the documented exception baseline", () => {
    const expected = new Map(
      hardcodedExceptions.exceptions.map((exception) => [exception.file, exception])
    );
    const actual = new Map(
      walkSourceFiles("src")
        .map((file) => [file, visualLiteralCounts(file)] as const)
        .filter(([, counts]) => counts.colorLiterals || counts.importantDeclarations || counts.inlineStyleAttributes)
    );

    expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());

    for (const [file, counts] of actual) {
      const exception = expected.get(file);
      expect(exception, `${file} missing from css-hardcoded-exceptions.json`).toBeDefined();
      expect(counts).toMatchObject({
        colorLiterals: exception?.colorLiterals,
        importantDeclarations: exception?.importantDeclarations,
        inlineStyleAttributes: exception?.inlineStyleAttributes
      });
    }
  });
});
