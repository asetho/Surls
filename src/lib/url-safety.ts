import dns from "node:dns/promises";
import net from "node:net";
import { env } from "./env";

const BLOCKED_PROTOCOLS = new Set(["javascript:", "data:", "file:", "ftp:", "mailto:", "tel:"]);
const LOCAL_HOSTNAMES = new Set(["localhost", "local", "host.docker.internal"]);

function isPrivateIPv4(ip: string) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 192 && b === 0 && (parts[2] === 0 || parts[2] === 2)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0 && parts[2] === 113) ||
    (a === 0) ||
    (a >= 224)
  );
}

function normalizeIpLiteral(ip: string) {
  return ip.toLowerCase().replace(/^\[|\]$/g, "");
}

export type ResolvedHttpAddress = {
  address: string;
  family: 4 | 6;
};

function ipv4FromMappedIPv6(ip: string) {
  const normalized = normalizeIpLiteral(ip);
  if (!normalized.startsWith("::ffff:")) return null;
  const mapped = normalized.slice("::ffff:".length);
  if (net.isIP(mapped) === 4) return mapped;

  const parts = mapped.split(":");
  if (
    parts.length !== 2 ||
    parts.some((part) => !/^[\da-f]{1,4}$/i.test(part))
  ) {
    return null;
  }

  const high = Number.parseInt(parts[0], 16);
  const low = Number.parseInt(parts[1], 16);
  return `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
}

function isPrivateIPv6(ip: string) {
  const normalized = normalizeIpLiteral(ip);
  const mappedIpv4 = ipv4FromMappedIPv6(normalized);
  if (mappedIpv4) return isPrivateIPv4(mappedIpv4);

  const firstHextet = Number.parseInt(normalized.split(":")[0] || "0", 16);
  return (
    normalized === "::1" ||
    normalized === "::" ||
    (firstHextet >= 0xfc00 && firstHextet <= 0xfdff) ||
    (firstHextet >= 0xfe80 && firstHextet <= 0xfebf) ||
    (firstHextet >= 0xfec0 && firstHextet <= 0xfeff) ||
    (firstHextet >= 0xff00 && firstHextet <= 0xffff)
  );
}

export function isPrivateAddress(ip: string) {
  const normalized = normalizeIpLiteral(ip);
  const family = net.isIP(normalized);
  if (family === 4) return isPrivateIPv4(normalized);
  if (family === 6) return isPrivateIPv6(normalized);
  return false;
}

export function parseSafeHttpUrl(value: string, allowPrivate = env.ALLOW_PRIVATE_DESTINATIONS) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return { ok: false as const, error: "Enter a valid absolute URL." };
  }

  if (BLOCKED_PROTOCOLS.has(url.protocol) || !["http:", "https:"].includes(url.protocol)) {
    return { ok: false as const, error: "Only HTTP and HTTPS destination URLs are allowed." };
  }

  if (!allowPrivate) {
    const hostname = url.hostname.toLowerCase();
    if (LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
      return { ok: false as const, error: "Local and internal hostnames are blocked." };
    }
    if (isPrivateAddress(hostname)) {
      return { ok: false as const, error: "Private network destinations are blocked." };
    }
  }

  url.hash = "";
  return { ok: true as const, url: url.toString() };
}

export async function resolveSafeHttpAddress(
  urlText: string,
  allowPrivate = env.ALLOW_PRIVATE_DESTINATIONS
): Promise<ResolvedHttpAddress> {
  const parsed = new URL(urlText);
  const records = await dns.lookup(normalizeIpLiteral(parsed.hostname), { all: true, verbatim: true });
  if (!records.length || (!allowPrivate && records.some((record) => isPrivateAddress(record.address)))) {
    throw new Error("Destination resolves to a private or internal address.");
  }

  const record = records[0];
  const family = net.isIP(record.address);
  if (family !== 4 && family !== 6) {
    throw new Error("Destination did not resolve to an IP address.");
  }

  return { address: record.address, family };
}

export async function assertNoPrivateResolution(urlText: string, allowPrivate = env.ALLOW_PRIVATE_DESTINATIONS) {
  await resolveSafeHttpAddress(urlText, allowPrivate);
  return true;
}

export function appendForwardedQuery(destination: string, sourceQuery: string) {
  if (!sourceQuery) return destination;
  const url = new URL(destination);
  const incoming = new URLSearchParams(sourceQuery);
  incoming.forEach((value, key) => {
    if (!url.searchParams.has(key)) {
      url.searchParams.append(key, value);
    }
  });
  return url.toString();
}
