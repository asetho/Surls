import { describe, expect, it } from "vitest";
import { parseCsvRows } from "@/lib/csv";

describe("CSV parsing", () => {
  it("parses quoted commas and escaped quotes", () => {
    expect(parseCsvRows('"https://example.com/a,b",alias,"Title ""quoted"""')).toEqual([
      ["https://example.com/a,b", "alias", 'Title "quoted"']
    ]);
  });

  it("rejects unclosed quoted fields", () => {
    expect(() => parseCsvRows('"https://example.com')).toThrow(/unclosed/i);
  });
});
