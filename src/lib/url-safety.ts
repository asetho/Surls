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
    (a === 0) ||
    (a >= 224)
  );
}

function isPrivateIPv6(ip: string) {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80") ||
    normalized === "::" ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

export function isPrivateAddress(ip: string) {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
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

export async function assertNoPrivateResolution(urlText: string, allowPrivate = env.ALLOW_PRIVATE_DESTINATIONS) {
  if (allowPrivate) return true;
  const parsed = new URL(urlText);
  const records = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
  if (records.some((record) => isPrivateAddress(record.address))) {
    throw new Error("Destination resolves to a private or internal address.");
  }
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
