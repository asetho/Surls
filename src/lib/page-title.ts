import http from "node:http";
import https from "node:https";
import { Readable } from "node:stream";
import { parseSafeHttpUrl, resolveSafeHttpAddress, type ResolvedHttpAddress } from "./url-safety";

const FETCH_TIMEOUT_MS = 3500;
const MAX_TITLE_BYTES = 64 * 1024;
const MAX_REDIRECTS = 3;
const MAX_TITLE_LENGTH = 180;
const HTML_CONTENT_TYPE = /\b(?:text\/html|application\/xhtml\+xml)\b/i;

type PinnedRequestInit = RequestInit & {
  resolvedAddress: ResolvedHttpAddress;
};

type FetchLike = (input: string | URL, init: PinnedRequestInit) => Promise<Response>;

type FetchPageTitleOptions = {
  fetchImpl?: FetchLike;
  resolveSafeAddress?: typeof resolveSafeHttpAddress;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\""
};

function fetchWithPinnedAddress(input: string | URL, init: PinnedRequestInit) {
  const url = new URL(input);
  const client = url.protocol === "https:" ? https : http;

  return new Promise<Response>((resolve, reject) => {
    const request = client.request(
      url,
      {
        headers: Object.fromEntries(new Headers(init.headers)),
        lookup: (_hostname, options, callback) => {
          if (options.all) {
            callback(null, [init.resolvedAddress]);
            return;
          }
          callback(null, init.resolvedAddress.address, init.resolvedAddress.family);
        },
        servername: url.hostname,
        signal: init.signal ?? undefined
      },
      (response) => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(response.headers)) {
          if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
        }

        resolve(
          new Response(Readable.toWeb(response) as ReadableStream<Uint8Array>, {
            headers,
            status: response.statusCode ?? 500,
            statusText: response.statusMessage
          })
        );
      }
    );

    request.once("error", reject);
    request.end();
  });
}

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#(\d+)|#x([\da-f]+)|[a-z][\w-]*);/gi, (match, entity, decimal, hex) => {
    const codePoint = decimal ? Number.parseInt(decimal, 10) : hex ? Number.parseInt(hex, 16) : null;
    if (codePoint !== null) {
      return codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    }
    return HTML_ENTITIES[String(entity).toLowerCase()] ?? match;
  });
}

export function extractHtmlTitle(html: string) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;

  const title = decodeHtmlEntities(match[1].replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();

  return title ? title.slice(0, MAX_TITLE_LENGTH).trimEnd() : null;
}

async function readTextPrefix(response: Response, maxBytes: number) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = maxBytes - total;
      const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
      chunks.push(chunk);
      total += chunk.byteLength;
      if (total >= maxBytes) await reader.cancel().catch(() => null);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function redirectUrl(currentUrl: string, location: string) {
  try {
    return new URL(location, currentUrl).toString();
  } catch {
    return null;
  }
}

export async function fetchPageTitle(destinationUrl: string, options: FetchPageTitleOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetchWithPinnedAddress;
  const resolveSafeAddress = options.resolveSafeAddress ?? resolveSafeHttpAddress;
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? MAX_TITLE_BYTES;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  let currentUrl = destinationUrl;

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const safe = parseSafeHttpUrl(currentUrl);
    if (!safe.ok) return null;

    let resolvedAddress: ResolvedHttpAddress;
    try {
      resolvedAddress = await resolveSafeAddress(safe.url);
    } catch {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(safe.url, {
        headers: {
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "user-agent": "Surls title fetcher"
        },
        redirect: "manual",
        resolvedAddress,
        signal: controller.signal
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return null;
        const nextUrl = redirectUrl(safe.url, location);
        if (!nextUrl) return null;
        currentUrl = nextUrl;
        continue;
      }

      if (!response.ok) return null;
      const contentType = response.headers.get("content-type") ?? "";
      if (!HTML_CONTENT_TYPE.test(contentType)) return null;

      return extractHtmlTitle(await readTextPrefix(response, maxBytes));
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}
