"use client";

import type { PointerEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { formatDateKey } from "@/lib/dates";

type DailyHistoryRow = {
  date: string;
  count: number;
};

type HistoryRange = "30d" | "1y" | "3y" | "5y";

type ChartPoint = DailyHistoryRow & {
  x: number;
  y: number;
};

type HoveredChartPoint = ChartPoint & {
  tooltipLeft: number;
  tooltipTop: number;
};

type SvgPoint = Pick<ChartPoint, "x" | "y">;

const historyRanges: Array<{ id: HistoryRange; label: string; days: number }> = [
  { id: "30d", label: "30 days", days: 30 },
  { id: "1y", label: "1 yr", days: 365 },
  { id: "3y", label: "3 yrs", days: 365 * 3 },
  { id: "5y", label: "5 yrs", days: 365 * 5 }
];

function svgNumber(value: number) {
  return value.toFixed(2);
}

function controlPoint(current: SvgPoint, previous: SvgPoint | undefined, next: SvgPoint | undefined, reverse = false) {
  const previousPoint = previous ?? current;
  const nextPoint = next ?? current;
  const smoothing = 0.18;
  const length = Math.hypot(nextPoint.x - previousPoint.x, nextPoint.y - previousPoint.y);
  const angle = Math.atan2(nextPoint.y - previousPoint.y, nextPoint.x - previousPoint.x) + (reverse ? Math.PI : 0);

  return {
    x: current.x + Math.cos(angle) * length * smoothing,
    y: current.y + Math.sin(angle) * length * smoothing
  };
}

function smoothLinePath(points: SvgPoint[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${svgNumber(points[0].x)} ${svgNumber(points[0].y)}`;

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${svgNumber(point.x)} ${svgNumber(point.y)}`;

    const previous = points[index - 1];
    const previousPrevious = points[index - 2];
    const next = points[index + 1];
    const firstControlPoint = controlPoint(previous, previousPrevious, point);
    const secondControlPoint = controlPoint(point, previous, next, true);

    return [
      path,
      "C",
      svgNumber(firstControlPoint.x),
      svgNumber(firstControlPoint.y),
      svgNumber(secondControlPoint.x),
      svgNumber(secondControlPoint.y),
      svgNumber(point.x),
      svgNumber(point.y)
    ].join(" ");
  }, "");
}

function smoothAreaPath(points: SvgPoint[], baselineY: number) {
  const linePath = smoothLinePath(points);
  if (!linePath || !points.length) return "";

  const firstPoint = points[0];
  const lastPoint = points.at(-1)!;
  return [
    linePath,
    "L",
    svgNumber(lastPoint.x),
    svgNumber(baselineY),
    "L",
    svgNumber(firstPoint.x),
    svgNumber(baselineY),
    "Z"
  ].join(" ");
}

function HistoryChart({ days }: { days: DailyHistoryRow[] }) {
  const width = 760;
  const height = 220;
  const pad = 34;
  const plotRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<HoveredChartPoint | null>(null);
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
  const linePath = smoothLinePath(linePoints);
  const areaPath = smoothAreaPath(linePoints, height - pad);
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = Math.round((max / 4) * index);
    const y = height - pad - (value / max) * innerHeight;
    return { value, y };
  });
  const hoverLabel = hovered
    ? `${formatDateKey(hovered.date)}: ${hovered.count} hit${hovered.count === 1 ? "" : "s"}`
    : "";

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!points.length) {
      setHovered(null);
      return;
    }

    const svg = event.currentTarget;
    const svgRect = svg.getBoundingClientRect();
    const plotRect = plotRef.current?.getBoundingClientRect() ?? svgRect;
    const matrix = svg.getScreenCTM();
    let x = ((event.clientX - svgRect.left) / svgRect.width) * width;

    if (matrix) {
      const pointer = svg.createSVGPoint();
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      x = pointer.matrixTransform(matrix.inverse()).x;
    }

    const index =
      points.length === 1
        ? 0
        : Math.min(points.length - 1, Math.max(0, Math.round(((x - pad) / innerWidth) * (points.length - 1))));
    const nextPoint = points[index];
    const tooltipPosition = { x: (nextPoint.x / width) * svgRect.width, y: (nextPoint.y / height) * svgRect.height };

    if (matrix) {
      const anchor = svg.createSVGPoint();
      anchor.x = nextPoint.x;
      anchor.y = nextPoint.y;
      const screenAnchor = anchor.matrixTransform(matrix);
      tooltipPosition.x = screenAnchor.x - plotRect.left;
      tooltipPosition.y = screenAnchor.y - plotRect.top;
    }

    const nextHover = {
      ...nextPoint,
      tooltipLeft: tooltipPosition.x,
      tooltipTop: tooltipPosition.y
    };
    setHovered((current) =>
      current?.date === nextHover.date &&
      current.count === nextHover.count &&
      current.tooltipLeft === nextHover.tooltipLeft &&
      current.tooltipTop === nextHover.tooltipTop
        ? current
        : nextHover
    );
  }

  return (
    <div className="history-chart" aria-label="Historical click count">
      <div className="history-chart-plot" ref={plotRef}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-describedby={hovered ? "history-chart-tooltip" : undefined}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHovered(null)}
        >
          <title>Historical click count</title>
          {grid.map((line, index) => (
            <g key={`${index}-${line.value}`}>
              <line x1={pad} x2={width - pad} y1={line.y} y2={line.y} />
              <text x={8} y={line.y + 4}>{line.value}</text>
            </g>
          ))}
          {areaPath ? <path className="history-area" d={areaPath} /> : null}
          {linePath ? <path className="history-line" d={linePath} /> : null}
          {points.length <= 90
            ? points.map((point) => (
                <circle key={point.date} cx={point.x} cy={point.y} r={3}>
                  <title>{`${formatDateKey(point.date)}: ${point.count} hit${point.count === 1 ? "" : "s"}`}</title>
                </circle>
              ))
            : null}
          {hovered ? (
            <g className="chart-hover-marker" aria-hidden>
              <line x1={hovered.x} x2={hovered.x} y1={pad} y2={height - pad} />
              <circle cx={hovered.x} cy={hovered.y} r={5} />
            </g>
          ) : null}
        </svg>
        {hovered ? (
          <div
            className="chart-tooltip"
            id="history-chart-tooltip"
            role="status"
            style={{
              left: `${hovered.tooltipLeft}px`,
              top: `${hovered.tooltipTop}px`
            }}
          >
            {hoverLabel}
          </div>
        ) : null}
      </div>
      <div className="chart-axis-labels">
        <span>{days[0] ? formatDateKey(days[0].date) : "No clicks"}</span>
        <span>{days.at(-1) ? formatDateKey(days.at(-1)!.date) : ""}</span>
      </div>
    </div>
  );
}

export function HistoricalClicksPanel({
  allTimeRate,
  dailyHistory,
  periodCounts
}: {
  allTimeRate: number;
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
