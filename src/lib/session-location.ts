import { BlockList, isIP } from "node:net";
import { clientIpFromHeaders } from "./request";

const localAddresses = new BlockList();
for (const [address, prefix] of [
  ["10.0.0.0", 8], ["172.16.0.0", 12], ["192.168.0.0", 16],
  ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16]
] as const) localAddresses.addSubnet(address, prefix, "ipv4");
localAddresses.addAddress("::1", "ipv6");
localAddresses.addSubnet("fc00::", 7, "ipv6");
localAddresses.addSubnet("fe80::", 10, "ipv6");

function validHeaderValue(value: string | undefined, maxLength = 128): value is string {
  return !!value && value.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(value);
}

function headerValue(headers: Headers, names: string[], maxLength = 128) {
  for (const name of names) {
    const value = headers.get(name)?.trim();
    if (validHeaderValue(value, maxLength)) return value;
  }
  return null;
}

function cityValue(headers: Headers) {
  const encoded = headerValue(headers, ["cf-ipcity"], 1536);
  if (encoded) {
    try {
      const decoded = decodeURIComponent(encoded).trim();
      if (validHeaderValue(decoded)) return decoded;
    } catch {
      // Discard malformed Cloudflare escapes.
    }
  }
  return headerValue(headers, ["x-geo-city"]);
}

// Keep only approximate place names; neither the address nor precise coordinates are persisted.
export function sessionLocationFromHeaders(headers: Headers, trustProxy: boolean) {
  if (!trustProxy) return null;
  const ip = clientIpFromHeaders(headers, trustProxy);
  const family = isIP(ip);
  if (family && localAddresses.check(ip, family === 4 ? "ipv4" : "ipv6")) {
    return { country: null, region: null, city: null, localNetwork: true };
  }

  const countryValue = headerValue(headers, ["cf-ipcountry", "x-vercel-ip-country", "x-country-code", "x-geo-country"])?.toUpperCase();
  const country = countryValue && /^[A-Z]{2}$/.test(countryValue) && countryValue !== "XX" ? countryValue : null;
  const region = headerValue(headers, ["cf-region", "cf-region-code", "x-vercel-ip-country-region", "x-region-code", "x-geo-region"]);
  const city = cityValue(headers);
  if (!family && !country && !region && !city) return null;
  return { country, region, city, localNetwork: false };
}
