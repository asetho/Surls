import { formatDateTime } from "./dates";
import type { RecentClickPagination } from "./clicks";

type RecentClickSource = {
  country: string | null;
  id: string;
  ipAddress: string | null;
  occurredAt: Date;
  referrer: string | null;
  userAgent: string | null;
};

export type RecentClickViewRow = {
  countryLabel: string;
  id: string;
  ipAddressLabel: string;
  occurredAtLabel: string;
  referrerLabel: string;
  userAgentLabel: string;
};

export type RecentClicksView = {
  pagination: RecentClickPagination;
  rows: RecentClickViewRow[];
  summary: {
    end: number;
    start: number;
    total: number;
  };
};

export function recentClicksView(
  rows: RecentClickSource[],
  pagination: RecentClickPagination,
  displayTimeZone: string
): RecentClicksView {
  const start = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.total, start + rows.length - 1);

  return {
    pagination,
    rows: rows.map((click) => ({
      countryLabel: click.country || "Unknown",
      id: click.id,
      ipAddressLabel: click.ipAddress || "Unknown",
      occurredAtLabel: formatDateTime(click.occurredAt, displayTimeZone),
      referrerLabel: click.referrer || "direct",
      userAgentLabel: click.userAgent || "Unknown user agent"
    })),
    summary: {
      end,
      start,
      total: pagination.total
    }
  };
}
