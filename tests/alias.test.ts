import { describe, expect, it } from "vitest";
import { generateAlias, isReservedAlias, validateAlias } from "@/lib/alias";

describe("alias validation", () => {
  it("rejects reserved routes", () => {
    expect(isReservedAlias("admin")).toBe(true);
    expect(isReservedAlias("favicon.svg")).toBe(true);
    expect(isReservedAlias("site.webmanifest")).toBe(true);
    expect(validateAlias("admin")).toMatch(/reserved/i);
    expect(validateAlias("api")).toMatch(/reserved/i);
  });

  it("rejects path traversal and confusing aliases", () => {
    expect(validateAlias("../etc")).toMatch(/characters/i);
    expect(validateAlias("test.html")).toMatch(/letters, numbers, underscores, or hyphens/i);
    expect(validateAlias("ab")).toMatch(/3-64/);
    expect(validateAlias("O0I")).toMatch(/confusing/i);
  });

  it("accepts simple safe aliases", () => {
    expect(validateAlias("docs-24")).toBeNull();
    expect(validateAlias("team-tags")).toBeNull();
    expect(validateAlias("hetrixtools")).toBeNull();
  });

  it("generates five-character aliases by default", () => {
    const alias = generateAlias();

    expect(alias).toHaveLength(5);
    expect(alias).toMatch(/^[abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
    expect(generateAlias(256)).toMatch(/[A-Z]/);
  });
});
