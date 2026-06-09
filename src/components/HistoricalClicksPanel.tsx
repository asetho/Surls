"use client";

import { useMemo, useState } from "react";
import { formatDateKey } from "@/lib/dates";

type DailyHistoryRow = {
  date: string;
  count: number;
};

type HistoryRange = "30d" | "1y" | "3y" | "5y";

const historyRanges: Array<{ id: HistoryRange; label: string; days: number }> = [
  { id: "30d", label: "30 days", days: 30 },
  { id: "1y", label: "1 yr", days: 365 },
  { id: "3y", label: "3 yrs", days: 365 * 3 },
  { id: "5y", label: "5 yrs", days: 365 * 5 }
];

function HistoryChart({ days }: { days: DailyHistoryRow[] }) {
  const width = 760;
  const height = 260;
  const pad = 34;
  const max = Math.max(1, ...days.map((day) => day.count));
  const innerWidth = width - pad * 2;
  const innerHeight = height - pad * 2;
  const points = days.map((day, index) => {
    const x = days.length === 1 ? width / 2 : pad + (index / (days.length - 1)) * innerWidth;
    const y = height - pad - (day.count / max) * innerHeight;
    return { ...day, x, y };
  });
  const linePoints =
    points.length === 1
      ? [
          { ...points[0], x: pad },
          { ...points[0], x: width - pad }
        ]
      : points;
  const path = linePoints.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const area = linePoints.length ? `${pad},${height - pad} ${path} ${width - pad},${height - pad}` : "";
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = Math.round((max / 4) * index);
    const y = height - pad - (value / max) * innerHeight;
    return { value, y };
  });

  return (
    <div className="history-chart" aria-label="Historical click count">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        {grid.map((line, index) => (
          <g key={`${index}-${line.value}`}>
            <line x1={pad} x2={width - pad} y1={line.y} y2={line.y} />
            <text x={8} y={line.y + 4}>{line.value}</text>
          </g>
        ))}
        {area ? <polygon points={area} /> : null}
        {path ? <polyline points={path} /> : null}
        {points.length <= 90
          ? points.map((point) => (
              <circle key={point.date} cx={point.x} cy={point.y} r={3}>
                <title>{`${formatDateKey(point.date)}: ${point.count} hit${point.count === 1 ? "" : "s"}`}</title>
              </circle>
            ))
          : null}
      </svg>
      <div className="chart-axis-labels">
        <span>{days[0] ? formatDateKey(days[0].date) : "No clicks"}</span>
        <span>{days.at(-1) ? formatDateKey(days.at(-1)!.date) : ""}</span>
      </div>
    </div>
  );
}

export function HistoricalClicksPanel({
  allTimeRate,
  createdAtLabel,
  dailyHistory,
  periodCounts
}: {
  allTimeRate: number;
  createdAtLabel: string;
  dailyHistory: DailyHistoryRow[];
  periodCounts: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
    allTime: number;
  };
}) {
  const [range, setRange] = useState<HistoryRange>("30d");
  const selectedRange = historyRanges.find((option) => option.id === range) ?? historyRanges[0];
  const visibleDays = useMemo(
    () => dailyHistory.slice(Math.max(0, dailyHistory.length - selectedRange.days)),
    [dailyHistory, selectedRange.days]
  );
  const bestDay = visibleDays.reduce(
    (best, day) => (day.count > best.count ? day : best),
    { date: visibleDays[0]?.date ?? dailyHistory[0]?.date ?? "", count: 0 }
  );

  return (
    <div className="stats-panel">
      <div className="stats-panel-header">
        <div>
          <h2>Historical click count</h2>
          <p className="muted small">
            Short URL created on {createdAtLabel}. Stats exclude admin clicks when Track admin clicks is off.
          </p>
        </div>
        <div className="segmented-control" aria-label="Historical click range">
          {historyRanges.map((option) => (
            <button type="button" aria-pressed={range === option.id} onClick={() => setRange(option.id)} key={option.id}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="stats-history-grid">
        <HistoryChart days={visibleDays} />
        <div className="stats-summary">
          <div>
            <span>Last 24 hours</span>
            <strong>{periodCounts.last24Hours} hits</strong>
          </div>
          <div>
            <span>Last 7 days</span>
            <strong>{periodCounts.last7Days} hits</strong>
          </div>
          <div>
            <span>Last 30 days</span>
            <strong>{periodCounts.last30Days} hits</strong>
          </div>
          <div>
            <span>All time</span>
            <strong>
              {periodCounts.allTime} hits <span className="muted small">{allTimeRate.toFixed(1)} per day</span>
            </strong>
          </div>
          <div className="best-day">
            <span>Best day in selected range</span>
            <strong>
              {bestDay.count} hits{bestDay.date ? ` on ${formatDateKey(bestDay.date)}` : ""}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
