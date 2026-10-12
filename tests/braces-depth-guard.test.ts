import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const requireCjs = createRequire(import.meta.url);
const braces = requireCjs("braces") as (pattern: string) => string[];
const micromatch = requireCjs("micromatch") as (paths: string[], pattern: string) => string[];

describe("development glob parsing", () => {
  it("rejects deep brace nesting before exhausting the call stack", () => {
    const pattern = `${"{".repeat(4000)}x${"}".repeat(4000)}`;

    expect(() => braces(pattern)).toThrow(/exceeds max depth/);
  });

  it("preserves ordinary brace globs through micromatch", () => {
    expect(micromatch(["src/app/a.ts", "src/lib/b.ts", "src/test/c.ts"], "src/{app,lib}/*.ts")).toEqual([
      "src/app/a.ts",
      "src/lib/b.ts",
    ]);
  });
});
