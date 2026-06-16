import type { NextRequest } from "next/server";
import net from "node:net";
import { hashPrivacyValue } from "./crypto";
import { env } from "./env";

function normalizeForwardedIp(value: string | null | undefined) {
  const candidate = value?.split(",")[0]?.trim();
  if (!candidate) return null;

  const withoutBrackets = candidate.startsWith("[") && candidate.endsWith("]") ? candidate.slice(1, -1) : candidate;
  if (net.isIP(withoutBrackets)) return withoutBrackets;

  return null;
}

export function clientIpFromHeaders(headers: Headers, trustProxy: boolean) {
  if (!trustProxy) return "unknown";
  return normalizeForwardedIp(headers.get("x-forwarded-for")) ?? normalizeForwardedIp(headers.get("x-real-ip")) ?? "unknown";
}

export function requestIp(request: NextRequest) {
  return clientIpFromHeaders(request.headers, env.TRUST_PROXY);
}

export function requestIpHash(request: NextRequest) {
  return hashPrivacyValue(requestIp(request));
}

function firstHeaderValue(request: NextRequest, names: string[]) {
  if (!env.TRUST_PROXY) return null;
  for (const name of names) {
    const value = request.headers.get(name)?.split(",")[0]?.trim();
    if (value) return value;
  }
  return null;
}

export function requestCountry(request: NextRequest) {
  const country = firstHeaderValue(request, ["cf-ipcountry", "x-vercel-ip-country", "x-country-code", "x-geo-country"]);
  if (!country || country === "XX") return null;
  return country.toUpperCase();
}

export function requestRegion(request: NextRequest) {
  return firstHeaderValue(request, ["cf-region", "x-vercel-ip-country-region", "x-region-code", "x-geo-region"]);
}

export function userAgentSummary(userAgent: string | null) {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Unknown";
  const device = /Mobile|Android|iPhone|iPad/.test(ua) ? "Mobile" : "Desktop";
  return { browser, device };
}
