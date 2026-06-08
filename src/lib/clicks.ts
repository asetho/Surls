import type { NextRequest } from "next/server";
import { hashPrivacyValue } from "./crypto";
import { prisma } from "./prisma";
import { requestIp, requestIpHash, userAgentSummary } from "./request";

export async function recordClick(input: {
  shortLinkId: string;
  request: NextRequest;
}) {
  const userAgent = input.request.headers.get("user-agent");
  const referrer = input.request.headers.get("referer");
  const ipHash = requestIpHash(input.request);
  const visitorHash = hashPrivacyValue(`${requestIp(input.request)}:${userAgent ?? ""}`);
  const { browser, device } = userAgentSummary(userAgent);

  await prisma.$transaction([
    prisma.clickEvent.create({
      data: {
        shortLinkId: input.shortLinkId,
        referrer,
        userAgent,
        browser,
        device,
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

export async function clickStats(shortLinkId: string) {
  const [total, unique, recent, byReferrer, byBrowser] = await Promise.all([
    prisma.clickEvent.count({ where: { shortLinkId } }),
    prisma.clickEvent.groupBy({ by: ["visitorHash"], where: { shortLinkId } }),
    prisma.clickEvent.findMany({
      where: { shortLinkId },
      orderBy: { occurredAt: "desc" },
      take: 25
    }),
    prisma.clickEvent.groupBy({
      by: ["referrer"],
      where: { shortLinkId },
      _count: { referrer: true },
      orderBy: { _count: { referrer: "desc" } },
      take: 10
    }),
    prisma.clickEvent.groupBy({
      by: ["browser"],
      where: { shortLinkId },
      _count: { browser: true },
      orderBy: { _count: { browser: "desc" } },
      take: 10
    })
  ]);

  return {
    total,
    unique: unique.length,
    recent,
    byReferrer,
    byBrowser
  };
}
