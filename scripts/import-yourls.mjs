#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const CLICK_BATCH_SIZE = 1000;
const RESERVED_ALIASES = new Set([
  "admin",
  "api",
  "assets",
  "health",
  "login",
  "logout",
  "s",
  "static",
  "_next",
  "apple-touch-icon.png",
  "favicon.ico",
  "favicon.svg",
  "icon-192.png",
  "icon-512.png",
  "robots.txt",
  "site.webmanifest"
]);

function usage() {
  return `
Usage:
  npm run import:yourls -- --urls ./yourls_url.csv --logs ./yourls_log.csv --dry-run
  npm run import:yourls -- --urls ./yourls_url.csv --logs ./yourls_log.csv --confirm

Options:
  --urls <file>              Required CSV export of the YOURLS url table.
  --logs <file>              Optional CSV export of the YOURLS log table.
  --created-by-email <email> Attach imported links to an existing Surls user.
  --date-offset <offset>     Offset for naive MySQL timestamps. Default: Z. Example: -04:00
  --append-clicks            Append log rows instead of replacing existing click events for imported links.
  --store-raw-ip             Store raw imported IP addresses. Default stores only hashes.
  --confirm                  Write to the database. Without this, the script previews only.
  --dry-run                  Preview only.

Expected YOURLS url columns:
  keyword,url,title,timestamp,clicks

Expected YOURLS log columns:
  click_id,click_time,shorturl,referrer,user_agent,ip_address,country_code
`;
}

function parseArgs(argv) {
  const options = {
    appendClicks: false,
    confirm: false,
    dateOffset: "Z",
    dryRun: false,
    storeRawIp: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--urls" || arg === "--url-csv") {
      options.urlsPath = next;
      index += 1;
    } else if (arg === "--logs" || arg === "--log-csv") {
      options.logsPath = next;
      index += 1;
    } else if (arg === "--created-by-email") {
      options.createdByEmail = next;
      index += 1;
    } else if (arg === "--date-offset") {
      options.dateOffset = next;
      index += 1;
    } else if (arg === "--append-clicks") {
      options.appendClicks = true;
    } else if (arg === "--store-raw-ip") {
      options.storeRawIp = true;
    } else if (arg === "--confirm") {
      options.confirm = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.confirm) options.dryRun = true;
  if (!options.help && !options.urlsPath) throw new Error("--urls is required.");
  if (!/^(Z|[+-]\d{2}:\d{2})$/.test(options.dateOffset)) {
    throw new Error("--date-offset must be Z or an offset like -04:00.");
  }

  return options;
}

function parseCsvRows(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field.trim());
      field = "";
    } else if (char === "\n") {
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (inQuotes) throw new Error("CSV contains an unclosed quoted field.");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function readCsvObjects(filePath) {
  const absolutePath = path.resolve(filePath);
  const rows = parseCsvRows(fs.readFileSync(absolutePath, "utf8"));
  if (rows.length === 0) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((row, index) => {
    const object = { __rowNumber: index + 2 };
    for (let column = 0; column < headers.length; column += 1) {
      object[headers[column]] = row[column] ?? "";
    }
    return object;
  });
}

function firstValue(row, names) {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function parseOptionalDate(value, offset) {
  if (!value) return null;
  const trimmed = value.trim();
  const mysqlDateTime = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(trimmed);
  const date = mysqlDateTime ? new Date(`${mysqlDateTime[1]}T${mysqlDateTime[2]}${offset}`) : new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseClicks(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function legacyAliasError(code) {
  if (!code) return "Missing YOURLS keyword.";
  if (code.length > 191) return "YOURLS keyword is longer than 191 characters.";
  if (code.includes("/") || code.includes("\\") || code.includes("..")) {
    return "YOURLS keyword must be a single safe URL path segment.";
  }
  if (RESERVED_ALIASES.has(code.toLowerCase())) return "YOURLS keyword conflicts with a reserved Surls route.";
  return null;
}

function normalizeDestination(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function hashPrivacyValue(value, secret) {
  if (!value) return null;
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function isInsecurePrivacySecret(secret) {
  const value = secret?.trim() ?? "";
  return value.length < 32 || /replace|change|example|placeholder|secret/i.test(value) || new Set(value).size < 10;
}

function userAgentSummary(userAgent) {
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
  const device = /bot|crawler|spider/i.test(ua) ? "Bot" : /Mobile|Android|iPhone|iPad/.test(ua) ? "Mobile" : "Desktop";
  return { browser, device };
}

function normalizeCountry(value) {
  const country = value.trim().toUpperCase();
  if (!country || country === "XX") return null;
  return country.length === 2 ? country : null;
}

function mapUrlRows(rows, dateOffset) {
  const errors = [];
  const links = [];
  const seen = new Set();

  for (const row of rows) {
    const code = firstValue(row, ["keyword", "shorturl", "code"]);
    const aliasError = legacyAliasError(code);
    if (aliasError) {
      errors.push(`URL row ${row.__rowNumber}: ${aliasError}`);
      continue;
    }
    if (seen.has(code)) {
      errors.push(`URL row ${row.__rowNumber}: Duplicate YOURLS keyword "${code}".`);
      continue;
    }
    seen.add(code);

    const destinationUrl = normalizeDestination(firstValue(row, ["url", "destination_url", "destinationurl"]));
    if (!destinationUrl) {
      errors.push(`URL row ${row.__rowNumber}: Destination URL must be absolute HTTP or HTTPS.`);
      continue;
    }

    links.push({
      code,
      destinationUrl,
      title: firstValue(row, ["title"]) || null,
      createdAt: parseOptionalDate(firstValue(row, ["timestamp", "created_at", "createdat"]), dateOffset),
      clicks: parseClicks(firstValue(row, ["clicks", "click_count", "clickcount"]))
    });
  }

  return { errors, links };
}

function mapLogRows(rows, dateOffset, privacySecret) {
  const errors = [];
  const clicksByCode = new Map();

  for (const row of rows) {
    const code = firstValue(row, ["shorturl", "keyword", "code"]);
    const aliasError = legacyAliasError(code);
    if (aliasError) {
      errors.push(`Log row ${row.__rowNumber}: ${aliasError}`);
      continue;
    }

    const occurredAt = parseOptionalDate(firstValue(row, ["click_time", "clicktime", "occurred_at", "occurredat"]), dateOffset);
    if (!occurredAt) {
      errors.push(`Log row ${row.__rowNumber}: Missing or invalid click time.`);
      continue;
    }

    const userAgent = firstValue(row, ["user_agent", "useragent"]) || null;
    const ipAddress = firstValue(row, ["ip_address", "ip"]) || null;
    const { browser, device } = userAgentSummary(userAgent);
    const visitorSource = ipAddress || userAgent ? `${ipAddress ?? ""}:${userAgent ?? ""}` : `yourls:${code}:${firstValue(row, ["click_id", "id"]) || row.__rowNumber}`;
    const click = {
      occurredAt,
      referrer: firstValue(row, ["referrer", "referer"]) || null,
      userAgent,
      browser,
      device,
      country: normalizeCountry(firstValue(row, ["country_code", "countrycode", "country"])),
      region: null,
      rawIpAddress: ipAddress,
      ipHash: privacySecret ? hashPrivacyValue(ipAddress, privacySecret) : null,
      visitorHash: privacySecret ? hashPrivacyValue(visitorSource, privacySecret) : null
    };

    const list = clicksByCode.get(code) ?? [];
    list.push(click);
    clicksByCode.set(code, list);
  }

  for (const clicks of clicksByCode.values()) {
    clicks.sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
  }

  return { clicksByCode, errors };
}

async function createClicks(prisma, rows) {
  for (let index = 0; index < rows.length; index += CLICK_BATCH_SIZE) {
    await prisma.clickEvent.createMany({ data: rows.slice(index, index + CLICK_BATCH_SIZE) });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage().trim());
    return;
  }

  const urlRows = readCsvObjects(options.urlsPath);
  const { links, errors: urlErrors } = mapUrlRows(urlRows, options.dateOffset);
  const logRows = options.logsPath ? readCsvObjects(options.logsPath) : [];
  const privacySecret = options.dryRun || logRows.length === 0 ? null : process.env.AUTH_SECRET;
  if (!options.dryRun && logRows.length && isInsecurePrivacySecret(privacySecret)) {
    throw new Error("AUTH_SECRET must be a high-entropy random value of at least 32 characters to import click logs.");
  }
  const { clicksByCode, errors: logErrors } = mapLogRows(logRows, options.dateOffset, privacySecret);
  const linkCodes = new Set(links.map((link) => link.code));
  const orphanLogCodes = Array.from(clicksByCode.keys()).filter((code) => !linkCodes.has(code));

  const errors = [...urlErrors, ...logErrors];
  for (const code of orphanLogCodes) {
    errors.push(`Log CSV includes clicks for "${code}", but no matching URL row was found.`);
  }

  if (errors.length) {
    console.error(`YOURLS import validation failed with ${errors.length} issue${errors.length === 1 ? "" : "s"}:`);
    for (const error of errors.slice(0, 50)) console.error(`- ${error}`);
    if (errors.length > 50) console.error(`- ...and ${errors.length - 50} more.`);
    process.exitCode = 1;
    return;
  }

  const importedClickTotal = Array.from(clicksByCode.values()).reduce((sum, clicks) => sum + clicks.length, 0);
  const countMismatches = links.filter((link) => clicksByCode.has(link.code) && link.clicks !== clicksByCode.get(link.code).length);

  console.log(`YOURLS import preview:`);
  console.log(`- Links: ${links.length}`);
  console.log(`- Click events: ${importedClickTotal}`);
  console.log(`- Mode: ${options.dryRun ? "dry run" : options.appendClicks ? "append click events" : "replace click events for imported links"}`);
  if (countMismatches.length) {
    console.log(`- Click count mismatch warnings: ${countMismatches.length} link${countMismatches.length === 1 ? "" : "s"} have YOURLS counts that differ from log rows.`);
  }

  if (options.dryRun) {
    console.log("No database changes made. Rerun with --confirm to import.");
    return;
  }

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
  });

  try {
    let createdById = null;
    if (options.createdByEmail) {
      const user = await prisma.user.findUnique({ where: { email: options.createdByEmail } });
      if (!user) throw new Error(`No Surls user found for --created-by-email ${options.createdByEmail}.`);
      createdById = user.id;
    }

    const linkIdByCode = new Map();
    for (const link of links) {
      const row = await prisma.shortLink.upsert({
        where: { code: link.code },
        update: {
          destinationUrl: link.destinationUrl,
          title: link.title,
          createdAt: link.createdAt ?? undefined,
          createdById: createdById ?? undefined
        },
        create: {
          code: link.code,
          destinationUrl: link.destinationUrl,
          title: link.title,
          createdAt: link.createdAt ?? undefined,
          createdById,
          clickCount: options.logsPath ? 0 : link.clicks,
          lastClickedAt: null
        }
      });
      linkIdByCode.set(link.code, row.id);
    }

    const importedLinkIds = Array.from(linkIdByCode.values());
    if (options.logsPath && !options.appendClicks && importedLinkIds.length) {
      await prisma.clickEvent.deleteMany({ where: { shortLinkId: { in: importedLinkIds } } });
    }

    for (const link of links) {
      const shortLinkId = linkIdByCode.get(link.code);
      const clicks = clicksByCode.get(link.code) ?? [];
      const rows = clicks.map((click) => ({
        shortLinkId,
        occurredAt: click.occurredAt,
        referrer: click.referrer,
        userAgent: click.userAgent,
        browser: click.browser,
        device: click.device,
        country: click.country,
        region: click.region,
        ipAddress: options.storeRawIp ? click.rawIpAddress : null,
        ipHash: click.ipHash,
        visitorHash: click.visitorHash
      }));
      await createClicks(prisma, rows);

      const clickCount = options.logsPath ? await prisma.clickEvent.count({ where: { shortLinkId } }) : link.clicks;
      const lastClicked = options.logsPath
        ? await prisma.clickEvent.findFirst({ where: { shortLinkId }, orderBy: { occurredAt: "desc" }, select: { occurredAt: true } })
        : null;
      await prisma.shortLink.update({
        where: { id: shortLinkId },
        data: {
          clickCount,
          lastClickedAt: lastClicked?.occurredAt ?? null
        }
      });
    }

    console.log(`Imported ${links.length} links and ${importedClickTotal} click events from YOURLS.`);
    if (!options.storeRawIp) console.log("Raw IP addresses were not stored; ipHash and visitorHash were populated.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
