import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { STRUCTURAL_VISUAL_TOKEN_REGISTRY } from "@/lib/visual-tokens";

function walkFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(path);
    return /\.(tsx|css)$/.test(path) ? [path] : [];
  });
}

describe("visual system accessibility guards", () => {
  it("documents the structural token families that shape admin density", () => {
    const categories = new Set(STRUCTURAL_VISUAL_TOKEN_REGISTRY.map((token) => token.category));

    expect(categories).toEqual(
      new Set(["Typography", "Spacing", "Radius", "Controls", "Tables", "Shadows", "Motion", "Layers", "Breakpoints"])
    );
    expect(STRUCTURAL_VISUAL_TOKEN_REGISTRY.every((token) => token.status === "read-only" || token.status === "derived")).toBe(true);
  });

  it("keeps responsive admin tables on the shared data-table contract", () => {
    const tableClassPattern = /<table\s+className="([^"]*\bresponsive-table\b[^"]*)"/g;

    for (const file of walkFiles("src")) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(tableClassPattern)) {
        expect(match[1], `${file} responsive table is missing data-table`).toContain("data-table");
      }
    }
  });

  it("keeps motion and high-contrast coverage in the global visual layers", () => {
    const globals = readFileSync("src/app/globals.css", "utf8");
    const dataTables = readFileSync("src/app/admin-data.css", "utf8");
    const themeEditor = readFileSync("src/app/admin-theme-editor.css", "utf8");

    expect(globals).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globals).toContain("@media (forced-colors: active)");
    expect(dataTables).toContain("table.responsive-table td[data-label]::before");
    expect(themeEditor).toContain(".dashboard-theme-editor-toolbar");
  });

  it("keeps admin form and links-table alignment scoped", () => {
    const globals = readFileSync("src/app/globals.css", "utf8");
    const dataTables = readFileSync("src/app/admin-data.css", "utf8");

    expect(globals).toMatch(/\.form-grid\s*>\s*label\s*{[\s\S]*text-align:\s*left;/);
    expect(globals).toMatch(/\.modal-panel\s*{[\s\S]*text-align:\s*left;/);
    expect(globals).toMatch(/\.links-table\s+td\[data-label="Actions"\]\s*>\s*\.row-actions\s*{[\s\S]*justify-content:\s*flex-end;/);
    expect(dataTables).toMatch(/\.data-table-actions\s*>\s*\.row-actions\s*{[\s\S]*justify-content:\s*flex-end;/);
    expect(dataTables).toMatch(/\.data-table-links\s+\.data-table-numeric\s*{[\s\S]*text-align:\s*left;/);
    expect(dataTables).toMatch(/\.data-table-links\s+td\[data-label="Actions"\]\s*>\s*\.row-actions\s*{[\s\S]*justify-content:\s*flex-start;/);
    expect(dataTables).toMatch(/\.data-table-users\s+td\[data-label="Security"\]\s*>\s*\.row-actions\s*>\s*\.badge\s*{[\s\S]*flex:\s*0\s+0\s+auto;[\s\S]*width:\s*auto;/);
    expect(dataTables).toMatch(/\.link-list-summary\s*{[\s\S]*text-align:\s*right;/);
    expect(dataTables).toMatch(/\.dashboard-top-links-table\s+\.data-table-actions\s*{[\s\S]*text-align:\s*left;/);
    expect(dataTables).toMatch(/\.dashboard-top-links-table\s+\.data-table-actions\s+\.addtoany-share-button\s*{[\s\S]*overflow-wrap:\s*normal;[\s\S]*white-space:\s*nowrap;/);
    expect(globals).toMatch(/\.info-tooltip\s*{[\s\S]*border:\s*1px solid var\(--border\);/);
    expect(globals).toMatch(/\.info-tooltip\s*{[\s\S]*color:\s*var\(--link-color, var\(--color-teal\)\);/);
    expect(globals).toMatch(/\.admin-shell\[data-mobile-menu-side="right"\]\s+\.admin-sidebar-drawer-content\s*{[\s\S]*right:\s*0;[\s\S]*transform:\s*translateX\(104%\);/);
    expect(globals).toMatch(/\.admin-shell\[data-mobile-menu-side="left"\]\s+\.admin-sidebar-drawer-content\s*{[\s\S]*left:\s*0;[\s\S]*transform:\s*translateX\(-104%\);/);
    const deprecatedActiveShadowColorToken = ["--dashboard", "active", "shadow", "color"].join("-");
    expect(globals).not.toContain(deprecatedActiveShadowColorToken);
    expect(globals).not.toMatch(/\.admin-shell\[data-mobile-menu-side="right"\]\s+\.admin-sidebar-drawer-content\s*{[^}]*box-shadow:/);
    expect(globals).not.toMatch(/\.admin-shell\[data-mobile-menu-side="left"\]\s+\.admin-sidebar-drawer-content\s*{[^}]*box-shadow:/);
    expect(globals).toMatch(/\.admin-sidebar-drawer-content\s*{[\s\S]*width:\s*min\(17rem,\s*76vw\);/);
    expect(globals).toMatch(/\.admin-shell\s+\.admin-sidebar-toggle:checked\s*~\s*\.admin-sidebar-drawer-content\s*{[\s\S]*transform:\s*translateX\(0\);/);
    expect(globals).toMatch(/\.profile-mobile-menu-side-options\s*{[\s\S]*background:\s*var\(--color-navy\);[\s\S]*border:\s*1px solid var\(--sidebar-border\);/);
    expect(globals).toMatch(/\.profile-mobile-menu-side-option input:checked\s*\+\s*\.profile-mobile-menu-side-option-label\s*{[\s\S]*background:\s*var\(--color-teal\);/);
    expect(globals).not.toMatch(/\.profile-mobile-menu-side-option input:focus-visible\s*\+\s*\.profile-mobile-menu-side-option-label\s*{[^}]*box-shadow:/);
  });
});
