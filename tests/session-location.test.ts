import { describe, expect, it } from "vitest";
import { sessionLocationFromHeaders } from "@/lib/session-location";

describe("session location", () => {
  it("accepts coarse Cloudflare location only from the trusted proxy", () => {
    const headers = new Headers({ "x-forwarded-for": "8.8.8.8", "cf-ipcountry": "US", "cf-region": "Pennsylvania", "cf-iplatitude": "40" });
    expect(sessionLocationFromHeaders(headers, false)).toBeNull();
    expect(sessionLocationFromHeaders(headers, true)).toEqual({ country: "US", region: "Pennsylvania", localNetwork: false });
  });

  it.each(["10.0.0.4", "172.16.1.1", "192.168.1.8", "100.64.0.1", "100.127.255.254", "127.0.0.1", "169.254.1.1", "::1", "fd7a:115c:a1e0::1", "fe80::1", "::ffff:192.168.1.1", "0:0:0:0:0:ffff:c0a8:101"])("labels %s as a local network without saving its address", (ip) => {
    expect(sessionLocationFromHeaders(new Headers({ "x-forwarded-for": ip, "cf-ipcountry": "US" }), true))
      .toEqual({ country: null, region: null, localNetwork: true });
  });

  it("supports a trusted local GeoIP proxy and country-only results", () => {
    expect(sessionLocationFromHeaders(new Headers({ "x-geo-country": "ca", "x-geo-region": "Ontario" }), true))
      .toEqual({ country: "CA", region: "Ontario", localNetwork: false });
    expect(sessionLocationFromHeaders(new Headers({ "cf-ipcountry": "US" }), true))
      .toEqual({ country: "US", region: null, localNetwork: false });
  });

  it("does not invent a location for unknown or invalid data", () => {
    for (const country of ["XX", "T1", "not a country"]) {
      expect(sessionLocationFromHeaders(new Headers({ "cf-ipcountry": country }), true)).toBeNull();
    }
    expect(sessionLocationFromHeaders(new Headers({ "x-forwarded-for": "not an IP", "cf-region": "a".repeat(129) }), true)).toBeNull();
    expect(sessionLocationFromHeaders(new Headers({ "x-forwarded-for": "8.8.8.8" }), true))
      .toEqual({ country: null, region: null, localNetwork: false });
  });
});
