"use client";

import type { MouseEvent, PointerEvent } from "react";
import { useState } from "react";

type CountRow = {
  label: string;
  count: number;
};

type PieSlice = CountRow & {
  color: string;
  end: number;
  start: number;
};

type TooltipState = {
  label: string;
  x: number;
  y: number;
};

const chartColors = [
  "var(--chart-pie-slice-1, var(--chart-color-1, var(--color-teal)))",
  "var(--chart-pie-slice-2, color-mix(in srgb, var(--chart-color-1, var(--color-teal)), var(--surface) 32%))",
  "var(--chart-pie-slice-3, color-mix(in srgb, var(--chart-color-1, var(--color-teal)), var(--surface) 58%))",
  "var(--chart-pie-slice-4, color-mix(in srgb, var(--chart-color-1, var(--color-teal)), var(--background) 72%))",
  "var(--chart-pie-slice-5, color-mix(in srgb, var(--chart-color-1, var(--color-teal)), var(--chart-color-2, var(--color-navy)) 48%))",
  "var(--chart-pie-slice-6, color-mix(in srgb, var(--chart-color-1, var(--color-teal)), var(--chart-color-2, var(--color-navy)) 72%))"
];

function hitLabel(count: number) {
  return `${count} hit${count === 1 ? "" : "s"}`;
}

function percentageLabel(count: number, total: number) {
  if (total <= 0) return "0%";
  return `${((count / total) * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

function tooltipLabel(row: CountRow, total: number) {
  return `${row.label}: ${hitLabel(row.count)} (${percentageLabel(row.count, total)})`;
}

function compactRows(rows: CountRow[], maxSlices = 6) {
  const cleanRows = rows.filter((row) => row.count > 0);
  const topRows = cleanRows.slice(0, maxSlices - 1);
  const otherCount = cleanRows.slice(maxSlices - 1).reduce((sum, row) => sum + row.count, 0);
  return otherCount > 0 ? [...topRows, { label: "Other", count: otherCount }] : cleanRows;
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  const radians = (angle - 90) * (Math.PI / 180);
  // Avoid server/browser hydration differences from tiny trigonometry rounding.
  return {
    x: Number((cx + radius * Math.cos(radians)).toFixed(6)),
    y: Number((cy + radius * Math.sin(radians)).toFixed(6))
  };
}

function arcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return [`M ${cx} ${cy}`, `L ${start.x} ${start.y}`, `A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`, "Z"].join(" ");
}

function pieSlices(rows: CountRow[]) {
  const total = Math.max(1, rows.reduce((sum, row) => sum + row.count, 0));
  let cursor = 0;

  return rows.map((row, index) => {
    const size = (row.count / total) * 360;
    const slice: PieSlice = {
      ...row,
      color: chartColors[index % chartColors.length],
      start: cursor,
      end: cursor + size
    };
    cursor += size;
    return slice;
  });
}

function shortLabel(label: string) {
  return label.length > 12 ? `${label.slice(0, 10)}...` : label;
}

function setTooltipFromPointer(
  event: MouseEvent<SVGCircleElement | SVGPathElement> | PointerEvent<SVGCircleElement | SVGPathElement>,
  label: string,
  setTooltip: (tooltip: TooltipState) => void
) {
  const rect = event.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
  if (!rect) return;
  setTooltip({
    label,
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  });
}

function DistributionChart({ emptyLabel, rows, title }: { emptyLabel: string; rows: CountRow[]; title: string }) {
  const cleanRows = rows.filter((row) => row.count > 0);
  const total = cleanRows.reduce((sum, row) => sum + row.count, 0);
  const slices = pieSlices(compactRows(cleanRows));
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  return (
    <section className="distribution-chart-card">
      <h3>{title}</h3>
      {cleanRows.length ? (
        <div className="distribution-pie-wrap">
          <svg className="distribution-pie" viewBox="0 0 220 220" role="img" aria-label={title}>
            <title>{title}</title>
            {slices.length === 1 ? (
              <circle
                aria-label={tooltipLabel(slices[0], total)}
                cx={110}
                cy={110}
                fill={slices[0].color}
                onMouseEnter={(event) => setTooltipFromPointer(event, tooltipLabel(slices[0], total), setTooltip)}
                onMouseLeave={() => setTooltip(null)}
                onMouseMove={(event) => setTooltipFromPointer(event, tooltipLabel(slices[0], total), setTooltip)}
                onPointerEnter={(event) => setTooltipFromPointer(event, tooltipLabel(slices[0], total), setTooltip)}
                onPointerLeave={() => setTooltip(null)}
                onPointerMove={(event) => setTooltipFromPointer(event, tooltipLabel(slices[0], total), setTooltip)}
                r={86}
                tabIndex={0}
              />
            ) : (
              slices.map((slice) => (
                <path
                  aria-label={tooltipLabel(slice, total)}
                  d={arcPath(110, 110, 86, slice.start, slice.end)}
                  fill={slice.color}
                  key={slice.label}
                  onMouseEnter={(event) => setTooltipFromPointer(event, tooltipLabel(slice, total), setTooltip)}
                  onMouseLeave={() => setTooltip(null)}
                  onMouseMove={(event) => setTooltipFromPointer(event, tooltipLabel(slice, total), setTooltip)}
                  onPointerEnter={(event) => setTooltipFromPointer(event, tooltipLabel(slice, total), setTooltip)}
                  onPointerLeave={() => setTooltip(null)}
                  onPointerMove={(event) => setTooltipFromPointer(event, tooltipLabel(slice, total), setTooltip)}
                  tabIndex={0}
                />
              ))
            )}
            {slices.map((slice) => {
              if (slice.count / total < 0.12) return null;
              const mid = slice.start + (slice.end - slice.start) / 2;
              const labelPoint = polarToCartesian(110, 110, 55, mid);
              return (
                <text x={labelPoint.x} y={labelPoint.y} textAnchor="middle" dominantBaseline="middle" key={`${slice.label}-label`}>
                  {shortLabel(slice.label)}
                </text>
              );
            })}
          </svg>
          {tooltip ? (
            <div className="chart-tooltip" role="status" style={{ left: tooltip.x, top: tooltip.y }}>
              {tooltip.label}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="muted">{emptyLabel}</p>
      )}
    </section>
  );
}

function DistributionDetails({ emptyLabel, rows, title }: { emptyLabel: string; rows: CountRow[]; title: string }) {
  const cleanRows = rows.filter((row) => row.count > 0);
  const total = cleanRows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...cleanRows.map((row) => row.count));

  return (
    <section className="distribution-info-card">
      <h3>{title}</h3>
      {cleanRows.length ? (
        <div className="distribution-bars">
          {cleanRows.slice(0, 8).map((row) => {
            const tooltipText = tooltipLabel(row, total);
            return (
              <div
                aria-label={tooltipText}
                className="distribution-row chart-tooltip-anchor"
                data-tooltip={tooltipText}
                key={row.label}
                tabIndex={0}
                title={tooltipText}
              >
                <span className="distribution-label">{row.label}</span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${(row.count / max) * 100}%`, display: "block" }} />
                </span>
                <strong>
                  {row.count} <span className="muted small">{percentageLabel(row.count, total)}</span>
                </strong>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted">{emptyLabel}</p>
      )}
    </section>
  );
}

export function SourcesCharts({
  direct,
  referrer,
  referrers
}: {
  direct: number;
  referrer: number;
  referrers: CountRow[];
}) {
  const sourceRows = [
    { label: "Direct", count: direct },
    { label: "Referrer", count: referrer }
  ];

  return (
    <div className="stats-card">
      <h2>Sources</h2>
      <div className="distribution-chart-grid">
        <DistributionChart emptyLabel="No source data yet." rows={sourceRows} title="Direct vs referrer traffic" />
        <DistributionChart emptyLabel="No referrer data yet." rows={referrers} title="Top referrers" />
      </div>
      <div className="distribution-info-grid">
        <DistributionDetails emptyLabel="No source data yet." rows={sourceRows} title="Traffic breakdown" />
        <DistributionDetails emptyLabel="No referrer data yet." rows={referrers} title="Referrer breakdown" />
      </div>
    </div>
  );
}

export function BrowserDeviceCharts({ browsers, devices }: { browsers: CountRow[]; devices: CountRow[] }) {
  return (
    <div className="stats-card">
      <h2>Browser/device</h2>
      <div className="distribution-chart-grid">
        <DistributionChart emptyLabel="No browser data yet." rows={browsers} title="Browsers" />
        <DistributionChart emptyLabel="No device data yet." rows={devices} title="Devices" />
      </div>
      <div className="distribution-info-grid">
        <DistributionDetails emptyLabel="No browser data yet." rows={browsers} title="Browser breakdown" />
        <DistributionDetails emptyLabel="No device data yet." rows={devices} title="Device breakdown" />
      </div>
    </div>
  );
}
