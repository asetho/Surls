import { describe, expect, it } from "vitest";
import { isReservedAlias, validateAlias } from "@/lib/alias";

describe("alias validation", () => {
  it("rejects reserved routes", () => {
    expect(isReservedAlias("admin")).toBe(true);
    expect(validateAlias("admin")).toMatch(/reserved/i);
    expect(validateAlias("api")).toMatch(/reserved/i);
  });

  it("rejects path traversal and confusing aliases", () => {
    expect(validateAlias("../etc")).toMatch(/characters/i);
    expect(validateAlias("test.html")).toMatch(/letters, numbers, underscores, or hyphens/i);
    expect(validateAlias("ab")).toMatch(/3-64/);
    expect(validateAlias("O0Il")).toMatch(/confusing/i);
  });

  it("accepts simple safe aliases", () => {
    expect(validateAlias("docs-24")).toBeNull();
    expect(validateAlias("team-tags")).toBeNull();
  });
});
