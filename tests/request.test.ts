import { describe, expect, it } from "vitest";
import { clientIpFromHeaders } from "@/lib/request";

describe("request IP handling", () => {
  it("ignores forwarded IP headers unless proxy trust is enabled", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.7, 10.0.0.2",
      "x-real-ip": "203.0.113.8"
    });

    expect(clientIpFromHeaders(headers, false)).toBe("unknown");
    expect(clientIpFromHeaders(headers, true)).toBe("203.0.113.7");
  });
});
