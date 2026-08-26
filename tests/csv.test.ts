import { describe, expect, it } from "vitest";
import { csvEscape, csvLine, parseCsvRows, toCsv } from "@/lib/csv";

describe("CSV parsing", () => {
  it("parses quoted commas and escaped quotes", () => {
    expect(parseCsvRows('"https://example.com/a,b",alias,"Title ""quoted"""')).toEqual([
      ["https://example.com/a,b", "alias", 'Title "quoted"']
    ]);
  });

  it("rejects unclosed quoted fields", () => {
    expect(() => parseCsvRows('"https://example.com')).toThrow(/unclosed/i);
  });

  it("stops parsing as soon as a configured row limit is exceeded", () => {
    expect(() => parseCsvRows("a\nb\nc", 2)).toThrow("Import at most 2 rows at a time.");
  });
});

describe("CSV escaping", () => {
  it("neutralizes spreadsheet formulas before serializing values", () => {
    for (const value of ["=1+1", "+1+1", "-1+1", "@SUM(A1:A2)", "  =1+1", "\t@SUM(A1:A2)"]) {
      expect(csvEscape(value)).toBe(`'${value}`);
    }
  });

  it("preserves ordinary CSV quoting and safe values", () => {
    expect(csvEscape("hello")).toBe("hello");
    expect(csvEscape('a,"b"')).toBe('"a,""b"""');
    expect(csvLine(["=1+1", "hello"])).toBe("'=1+1,hello\n");
    expect(toCsv([["@SUM(A1:A2)", "hello"]])).toBe("'@SUM(A1:A2),hello");
  });
});
