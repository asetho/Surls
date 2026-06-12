import { describe, expect, it } from "vitest";
import { destinationWarnings } from "@/lib/destination-warnings";

describe("destination warnings", () => {
  it("does not warn for normal HTTPS destinations", () => {
    expect(destinationWarnings("https://example.com/path")).toEqual([]);
  });

  it("warns for unencrypted HTTP destinations", () => {
    expect(destinationWarnings("http://example.com").map((warning) => warning.code)).toContain("http");
  });

  it("warns for IP-literal destinations", () => {
    expect(destinationWarnings("https://203.0.113.10/path").map((warning) => warning.code)).toContain("ip-address");
  });

  it("warns for punycode and userinfo domains", () => {
    const codes = destinationWarnings("https://user@xn--pple-43d.example").map((warning) => warning.code);
    expect(codes).toContain("punycode");
    expect(codes).toContain("userinfo");
  });
});
