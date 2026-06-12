import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { hashPrivacyValue } from "./crypto";
import { DEFAULT_DISPLAY_TIME_ZONE, dateKeyForTimeZone, enumerateDateKeys } from "./dates";
import { prisma } from "./prisma";
import { requestCountry, requestIp, requestIpHash, requestRegion, userAgentSummary } from "./request";

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_RECENT_CLICK_PAGE_SIZE = 20;
export const MAX_RECENT_CLICK_PAGE_SIZE = 500;
export const RAW_IP_RETENTION_DAYS = 30;

const RAW_IP_PURGE_INTERVAL_MS = DAY_MS;
let lastRawIpPurgeAt = 0;

function normalizePositiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(max, Math.floor(parsed));
}

export function normalizeRecentClickPage(value: unknown) {
  return normalizePositiveInteger(value, 1, Number.MAX_SAFE_INTEGER);
}

export function normalizeRecentClickPageSize(value: unknown) {
  return normalizePositiveInteger(value, DEFAULT_RECENT_CLICK_PAGE_SIZE, MAX_RECENT_CLICK_PAGE_SIZE);
}

function displayReferrer(referrer: string | null) {
  if (!referrer) return "Direct";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "") || referrer;
  } catch {
    return referrer;
  }
}

export function buildDailyHistory(
  createdAt: Date | null,
  clicks: Array<{ occurredAt: Date }>,
  timeZone = DEFAULT_DISPLAY_TIME_ZONE,
  now = new Date()
) {
  const counts = new Map<string, number>();
  for (const click of clicks) {
    const key = dateKeyForTimeZone(click.occurredAt, timeZone);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const firstClickAt = clicks[0]?.occurredAt;
  const startKey = dateKeyForTimeZone(createdAt ?? firstClickAt ?? now, timeZone);
  const endKey = dateKeyForTimeZone(now, timeZone);
  return enumerateDateKeys(startKey, endKey).map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

function numberCount(value: number | bigint) {
  return typeof value === "bigint" ? Number(value) : value;
}

const CLICK_GROUP_COLUMNS = {
  browser: Prisma.raw('"browser"'),
  country: Prisma.raw('"country"'),
  device: Prisma.raw('"device"')
} as const;

async function groupedClickCounts(shortLinkId: string, field: keyof typeof CLICK_GROUP_COLUMNS, limit = 50) {
  const column = CLICK_GROUP_COLUMNS[field];
  const rows = await prisma.$queryRaw<Array<{ label: string | null; count: number | bigint }>>(Prisma.sql`
    SELECT COALESCE(${column}, 'Unknown') AS label, COUNT(*)::int AS count
    FROM "ClickEvent"
    WHERE "shortLinkId" = ${shortLinkId}
    GROUP BY ${column}
    ORDER BY count DESC, label ASC
    LIMIT ${limit}
  `);
  return rows.map((row) => ({ label: row.label ?? "Unknown", count: numberCount(row.count) }));
}

async function referrerCounts(shortLinkId: string) {
  const rows = await prisma.$queryRaw<Array<{ referrer: string; count: number | bigint }>>(Prisma.sql`
    SELECT "referrer", COUNT(*)::int AS count
    FROM "ClickEvent"
    WHERE "shortLinkId" = ${shortLinkId} AND "referrer" IS NOT NULL
    GROUP BY "referrer"
    ORDER BY count DESC, "referrer" ASC
    LIMIT 100
  `);
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = displayReferrer(row.referrer);
    counts.set(label, (counts.get(label) ?? 0) + numberCount(row.count));
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

async function dailyClickRows(shortLinkId: string, timeZone: string) {
  const rows = await prisma.$queryRaw<Array<{ date: string; count: number | bigint }>>(Prisma.sql`
    SELECT to_char("occurredAt" AT TIME ZONE ${timeZone}, 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
    FROM "ClickEvent"
    WHERE "shortLinkId" = ${shortLinkId}
    GROUP BY date
    ORDER BY date ASC
  `);
  return rows.map((row) => ({ date: row.date, count: numberCount(row.count) }));
}

function buildDailyHistoryFromCounts(
  createdAt: Date | null,
  rows: Array<{ date: string; count: number }>,
  timeZone = DEFAULT_DISPLAY_TIME_ZONE,
  now = new Date()
) {
  const counts = new Map(rows.map((row) => [row.date, row.count]));
  const startKey = createdAt ? dateKeyForTimeZone(createdAt, timeZone) : rows[0]?.date ?? dateKeyForTimeZone(now, timeZone);
  const endKey = dateKeyForTimeZone(now, timeZone);
  return enumerateDateKeys(startKey, endKey).map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

export function rawIpRetentionCutoff(now = new Date()) {
  return new Date(now.getTime() - RAW_IP_RETENTION_DAYS * DAY_MS);
}

export async function purgeExpiredRawIpAddresses(now = new Date()) {
  return prisma.clickEvent.updateMany({
    where: {
      ipAddress: { not: null },
      occurredAt: { lt: rawIpRetentionCutoff(now) }
    },
    data: { ipAddress: null }
  });
}

async function purgeExpiredRawIpAddressesOnce(now = new Date()) {
  if (now.getTime() - lastRawIpPurgeAt < RAW_IP_PURGE_INTERVAL_MS) return;
  lastRawIpPurgeAt = now.getTime();
  await purgeExpiredRawIpAddresses(now);
}

export async function recordClick(input: {
  maxClicks: number | null;
  shortLinkId: string;
  request: NextRequest;
  storeEvent?: boolean;
}) {
  const userAgent = input.request.headers.get("user-agent");
  const referrer = input.request.headers.get("referer");
  const ipAddress = requestIp(input.request);
  const ipHash = requestIpHash(input.request);
  const visitorHash = hashPrivacyValue(`${ipAddress}:${userAgent ?? ""}`);
  const { browser, device } = userAgentSummary(userAgent);

  const recorded = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const updated = await tx.shortLink.updateMany({
      where: {
        id: input.shortLinkId,
        archivedAt: null,
        enabled: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        ...(input.maxClicks === null
          ? { maxClicks: null }
          : { maxClicks: input.maxClicks, clickCount: { lt: input.maxClicks } })
      },
      data: {
        clickCount: { increment: 1 },
        lastClickedAt: now
      }
    });
    if (updated.count !== 1) return false;

    if (input.storeEvent !== false) {
      await tx.clickEvent.create({
        data: {
          shortLinkId: input.shortLinkId,
          referrer,
          userAgent,
          browser,
          device,
          country: requestCountry(input.request),
          region: requestRegion(input.request),
          ipAddress,
          ipHash,
          visitorHash
        }
      });
    }
    return true;
  });
  void purgeExpiredRawIpAddressesOnce().catch(() => null);
  return recorded;
}

export async function clickStats(
  shortLinkId: string,
  createdAt: Date | null = null,
  timeZone = DEFAULT_DISPLAY_TIME_ZONE,
  recentOptions: { page?: number; pageSize?: number } = {}
) {
  const recentPageSize = normalizeRecentClickPageSize(recentOptions.pageSize);
  const requestedRecentPage = normalizeRecentClickPage(recentOptions.page);
  const now = new Date();
  const since24Hours = new Date(now.getTime() - DAY_MS);
  const since7Days = new Date(now.getTime() - 7 * DAY_MS);
  const since30Days = new Date(now.getTime() - 30 * DAY_MS);

  const [
    total,
    uniqueRows,
    dailyRows,
    last24Hours,
    last7Days,
    last30Days,
    directCount,
    referrerRows,
    countryCounts,
    browserCounts,
    deviceCounts
  ] = await Promise.all([
    prisma.clickEvent.count({ where: { shortLinkId } }),
    prisma.$queryRaw<Array<{ count: number | bigint }>>(Prisma.sql`
      SELECT COUNT(DISTINCT "visitorHash")::int AS count
      FROM "ClickEvent"
      WHERE "shortLinkId" = ${shortLinkId}
    `),
    dailyClickRows(shortLinkId, timeZone),
    prisma.clickEvent.count({ where: { shortLinkId, occurredAt: { gte: since24Hours } } }),
    prisma.clickEvent.count({ where: { shortLinkId, occurredAt: { gte: since7Days } } }),
    prisma.clickEvent.count({ where: { shortLinkId, occurredAt: { gte: since30Days } } }),
    prisma.clickEvent.count({ where: { shortLinkId, referrer: null } }),
    referrerCounts(shortLinkId),
    groupedClickCounts(shortLinkId, "country"),
    groupedClickCounts(shortLinkId, "browser"),
    groupedClickCounts(shortLinkId, "device")
  ]);
  const unique = numberCount(uniqueRows[0]?.count ?? 0);
  const recentPageCount = Math.max(1, Math.ceil(total / recentPageSize));
  const recentPage = Math.min(requestedRecentPage, recentPageCount);
  const recent = await prisma.clickEvent.findMany({
    where: { shortLinkId },
    orderBy: { occurredAt: "desc" },
    skip: (recentPage - 1) * recentPageSize,
    take: recentPageSize
  });

  const dailyHistory = buildDailyHistoryFromCounts(createdAt, dailyRows, timeZone, now);
  const bestDay = dailyHistory.reduce(
    (best, day) => (day.count > best.count ? day : best),
    { date: dailyHistory[0]?.date ?? dateKeyForTimeZone(now, timeZone), count: 0 }
  );
  const referrerCount = Math.max(0, total - directCount);

  return {
    total,
    unique,
    recent,
    recentPagination: {
      page: recentPage,
      pageCount: recentPageCount,
      pageSize: recentPageSize,
      total
    },
    byBrowser: browserCounts,
    byDevice: deviceCounts,
    dailyHistory,
    bestDay,
    periodCounts: {
      last24Hours,
      last7Days,
      last30Days,
      allTime: total
    },
    sourceCounts: {
      direct: directCount,
      referrer: referrerCount,
      referrers: referrerRows
    },
    countryCounts
  };
}
