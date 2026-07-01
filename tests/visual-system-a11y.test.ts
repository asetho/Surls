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
});
