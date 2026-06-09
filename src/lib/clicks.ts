import type { NextRequest } from "next/server";
import { hashPrivacyValue } from "./crypto";
import { DEFAULT_DISPLAY_TIME_ZONE, dateKeyForTimeZone, enumerateDateKeys } from "./dates";
import { prisma } from "./prisma";
import { requestCountry, requestIp, requestIpHash, requestRegion, userAgentSummary } from "./request";

const DAY_MS = 24 * 60 * 60 * 1000;

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

function countSince(clicks: Array<{ occurredAt: Date }>, since: Date) {
  return clicks.filter((click) => click.occurredAt >= since).length;
}

function topCounts<T extends string>(values: T[]) {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export async function recordClick(input: {
  shortLinkId: string;
  request: NextRequest;
}) {
  const userAgent = input.request.headers.get("user-agent");
  const referrer = input.request.headers.get("referer");
  const ipAddress = requestIp(input.request);
  const ipHash = requestIpHash(input.request);
  const visitorHash = hashPrivacyValue(`${ipAddress}:${userAgent ?? ""}`);
  const { browser, device } = userAgentSummary(userAgent);

  await prisma.$transaction([
    prisma.clickEvent.create({
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
    }),
    prisma.shortLink.update({
      where: { id: input.shortLinkId },
      data: {
        clickCount: { increment: 1 },
        lastClickedAt: new Date()
      }
    })
  ]);
}

export async function clickStats(
  shortLinkId: string,
  createdAt: Date | null = null,
  timeZone = DEFAULT_DISPLAY_TIME_ZONE
) {
  const [total, unique, recent, allClicks] = await Promise.all([
    prisma.clickEvent.count({ where: { shortLinkId } }),
    prisma.clickEvent.groupBy({ by: ["visitorHash"], where: { shortLinkId } }),
    prisma.clickEvent.findMany({
      where: { shortLinkId },
      orderBy: { occurredAt: "desc" },
      take: 100
    }),
    prisma.clickEvent.findMany({
      where: { shortLinkId },
      orderBy: { occurredAt: "asc" },
      select: { occurredAt: true, country: true, referrer: true, browser: true, device: true }
    })
  ]);

  const now = new Date();
  const dailyHistory = buildDailyHistory(createdAt, allClicks, timeZone, now);
  const bestDay = dailyHistory.reduce(
    (best, day) => (day.count > best.count ? day : best),
    { date: dailyHistory[0]?.date ?? dateKeyForTimeZone(now, timeZone), count: 0 }
  );
  const referrerCounts = topCounts(allClicks.flatMap((click) => (click.referrer ? [displayReferrer(click.referrer)] : [])));
  const countryCounts = topCounts(allClicks.map((click) => click.country ?? "Unknown"));
  const browserCounts = topCounts(allClicks.map((click) => click.browser ?? "Unknown"));
  const deviceCounts = topCounts(allClicks.map((click) => click.device ?? "Unknown"));
  const directCount = allClicks.filter((click) => !click.referrer).length;
  const referrerCount = Math.max(0, allClicks.length - directCount);

  return {
    total,
    unique: unique.length,
    recent,
    byBrowser: browserCounts,
    byDevice: deviceCounts,
    dailyHistory,
    bestDay,
    periodCounts: {
      last24Hours: countSince(allClicks, new Date(now.getTime() - DAY_MS)),
      last7Days: countSince(allClicks, new Date(now.getTime() - 7 * DAY_MS)),
      last30Days: countSince(allClicks, new Date(now.getTime() - 30 * DAY_MS)),
      allTime: total
    },
    sourceCounts: {
      direct: directCount,
      referrer: referrerCount,
      referrers: referrerCounts
    },
    countryCounts
  };
}
