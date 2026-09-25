import { describe, expect, it } from "vitest";
import { sessionLocationFromHeaders } from "@/lib/session-location";

describe("session location", () => {
  it("accepts approximate Cloudflare location only from the trusted proxy", () => {
    const headers = new Headers({ "x-forwarded-for": "8.8.8.8", "cf-ipcountry": "US", "cf-region": "Pennsylvania", "cf-ipcity": "Philadelphia", "cf-iplatitude": "40", "cf-iplongitude": "-75", "cf-postal-code": "19101" });
    expect(sessionLocationFromHeaders(headers, false)).toBeNull();
    expect(sessionLocationFromHeaders(headers, true)).toEqual({ country: "US", region: "Pennsylvania", city: "Philadelphia", localNetwork: false });
  });

  it.each(["10.0.0.4", "172.16.1.1", "192.168.1.8", "100.64.0.1", "100.127.255.254", "127.0.0.1", "169.254.1.1", "::1", "fd7a:115c:a1e0::1", "fe80::1", "::ffff:192.168.1.1", "0:0:0:0:0:ffff:c0a8:101"])("labels %s as a local network without saving its address", (ip) => {
    expect(sessionLocationFromHeaders(new Headers({ "x-forwarded-for": ip, "cf-ipcountry": "US", "cf-region": "Pennsylvania", "cf-ipcity": "Philadelphia" }), true))
      .toEqual({ country: null, region: null, city: null, localNetwork: true });
  });

  it("supports a trusted local GeoIP proxy and country-only results", () => {
    expect(sessionLocationFromHeaders(new Headers({ "x-geo-country": "ca", "x-geo-region": "Ontario", "x-geo-city": "Toronto" }), true))
      .toEqual({ country: "CA", region: "Ontario", city: "Toronto", localNetwork: false });
    expect(sessionLocationFromHeaders(new Headers({ "cf-ipcountry": "US" }), true))
      .toEqual({ country: "US", region: null, city: null, localNetwork: false });
  });

  it("keeps available city and state fields when other location headers are missing", () => {
    expect(sessionLocationFromHeaders(new Headers({ "cf-ipcity": "  Philadelphia  ", "cf-region-code": "PA" }), true))
      .toEqual({ country: null, region: "PA", city: "Philadelphia", localNetwork: false });
    expect(sessionLocationFromHeaders(new Headers({ "x-geo-city": "Toronto" }), true))
      .toEqual({ country: null, region: null, city: "Toronto", localNetwork: false });
  });

  it.each(["", "  ", "a".repeat(129), "city\u0001name", "city\u007fname"])("discards invalid city headers (%j)", (city) => {
    expect(sessionLocationFromHeaders(new Headers({ "cf-ipcity": city }), true)).toBeNull();
    expect(sessionLocationFromHeaders(new Headers({ "cf-ipcountry": "US", "x-geo-city": city }), true))
      .toEqual({ country: "US", region: null, city: null, localNetwork: false });
  });

  it("does not invent a location for unknown or invalid data", () => {
    for (const country of ["XX", "T1", "not a country"]) {
      expect(sessionLocationFromHeaders(new Headers({ "cf-ipcountry": country }), true)).toBeNull();
    }
    expect(sessionLocationFromHeaders(new Headers({ "x-forwarded-for": "not an IP", "cf-region": "a".repeat(129) }), true)).toBeNull();
    expect(sessionLocationFromHeaders(new Headers({ "x-forwarded-for": "8.8.8.8" }), true))
      .toEqual({ country: null, region: null, city: null, localNetwork: false });
  });
});
