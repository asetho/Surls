"use client";

import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { MouseEvent, PointerEvent } from "react";
import { useId, useState } from "react";
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { feature } from "topojson-client";
import countries110m from "world-atlas/countries-110m.json";
import type { GeometryCollection, Topology } from "topojson-specification";

type CountryCount = {
  label: string;
  count: number;
};

type CountryFeature = Feature<Geometry, GeoJsonProperties> & {
  id?: string | number;
};

type TooltipState = {
  label: string;
  x: number;
  y: number;
};

type MapTooltipState = {
  count: number;
  label: string;
  x: number;
  y: number;
};

const chartColors = [
  "var(--chart-color-2, var(--color-navy))",
  "var(--chart-color-7, color-mix(in srgb, var(--color-navy), var(--surface) 45%))",
  "var(--chart-color-3, var(--surface-strong))",
  "var(--chart-color-6, color-mix(in srgb, var(--color-teal), var(--surface) 35%))",
  "var(--chart-map-bucket-1, var(--surface-strong))",
  "var(--chart-map-empty, color-mix(in srgb, var(--surface), var(--surface-strong) 42%))"
];
const topology = countries110m as unknown as Topology<{ countries: GeometryCollection }>;
const countryFeatures = feature(topology, topology.objects.countries) as FeatureCollection<Geometry, GeoJsonProperties>;

countries.registerLocale(enLocale);

function normalizeCountryCode(label: string) {
  return label.trim().toUpperCase();
}

function numericCountryCode(code: string) {
  const numeric = countries.alpha2ToNumeric(code);
  return numeric ? numeric.padStart(3, "0") : null;
}

function countryName(code: string) {
  if (code === "UNKNOWN") return "Unknown";
  return countries.getName(code, "en") ?? code;
}

function numericCountryDisplayName(numericCode: string, fallbackName: string) {
  const alpha2 = countries.numericToAlpha2(numericCode);
  return alpha2 ? countryDisplayName(alpha2) : fallbackName;
}

function countryDisplayName(label: string) {
  const code = normalizeCountryCode(label);
  if (code === "OTHER") return "Other";
  return `${code} (${countryName(code)})`;
}

function countryFlag(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return code.slice(0, 2);
  const first = code.codePointAt(0);
  const second = code.codePointAt(1);
  if (!first || !second) return code;
  return String.fromCodePoint(first + 127397, second + 127397);
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  const radians = (angle - 90) * (Math.PI / 180);
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  };
}

function arcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return [`M ${cx} ${cy}`, `L ${start.x} ${start.y}`, `A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`, "Z"].join(" ");
}

function pieSlices(rows: CountryCount[]) {
  const top = rows.slice(0, 5);
  const otherCount = rows.slice(5).reduce((sum, row) => sum + row.count, 0);
  const data = otherCount > 0 ? [...top, { label: "Other", count: otherCount }] : top;
  const total = Math.max(1, data.reduce((sum, row) => sum + row.count, 0));
  let cursor = 0;

  return data.map((row, index) => {
    const size = (row.count / total) * 360;
    const slice = {
      ...row,
      color: chartColors[index % chartColors.length],
      start: cursor,
      end: cursor + size
    };
    cursor += size;
    return slice;
  });
}

function mapBucket(count: number, max: number) {
  if (count <= 0) return "";
  return `bucket-${Math.min(5, Math.max(1, Math.ceil((count / Math.max(1, max)) * 5)))}`;
}

function hitLabel(count: number) {
  return `${count} hit${count === 1 ? "" : "s"}`;
}

function percentageLabel(count: number, total: number) {
  if (total <= 0) return "0%";
  return `${((count / total) * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

function trafficTooltip(label: string, count: number, total: number) {
  return `${label}: ${hitLabel(count)} (${percentageLabel(count, total)})`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function legendMarkerPercent(count: number, min: number, max: number) {
  if (max <= 0) return 0;
  if (max === min) return 50;
  return clamp(((count - min) / (max - min)) * 100, 0, 100);
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

function setTooltipFromContainer(
  event: MouseEvent<HTMLElement>,
  setTooltip: (tooltip: TooltipState | null) => void
) {
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const tooltipTarget = target instanceof Element ? target.closest("[data-chart-tooltip]") : null;
  const label = tooltipTarget?.getAttribute("data-chart-tooltip");

  if (!target || !event.currentTarget.contains(target) || !label) {
    setTooltip(null);
    return;
  }

  const rect = event.currentTarget.getBoundingClientRect();
  setTooltip({
    label,
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  });
}

function setMapTooltipFromPointer(
  event: MouseEvent<SVGPathElement> | PointerEvent<SVGPathElement>,
  tooltip: Omit<MapTooltipState, "x" | "y">,
  setTooltip: (tooltip: MapTooltipState) => void
) {
  const rect = event.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
  if (!rect) return;

  setTooltip({
    ...tooltip,
    x: clamp(event.clientX - rect.left, 74, Math.max(74, rect.width - 74)),
    y: clamp(event.clientY - rect.top, 72, Math.max(72, rect.height - 18))
  });
}

function CountryPie({ rows }: { rows: CountryCount[] }) {
  const slices = pieSlices(rows);
  const total = Math.max(1, slices.reduce((sum, slice) => sum + slice.count, 0));
  const single = slices.length === 1;
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  return (
    <div className="chart-hover-layer" onMouseLeave={() => setTooltip(null)} onMouseMove={(event) => setTooltipFromContainer(event, setTooltip)}>
      <svg className="country-pie" viewBox="0 0 240 240" role="img" aria-label="Top countries pie chart">
        <title>Top countries by click count</title>
        {single ? (
          <circle
            aria-label={trafficTooltip(countryDisplayName(slices[0]?.label ?? ""), slices[0]?.count ?? 0, total)}
            cx={120}
            data-chart-tooltip={trafficTooltip(countryDisplayName(slices[0]?.label ?? ""), slices[0]?.count ?? 0, total)}
            cy={120}
            fill={slices[0]?.color ?? chartColors[0]}
            onMouseEnter={(event) =>
              setTooltipFromPointer(
                event,
                trafficTooltip(countryDisplayName(slices[0]?.label ?? ""), slices[0]?.count ?? 0, total),
                setTooltip
              )
            }
            onMouseLeave={() => setTooltip(null)}
            onMouseMove={(event) =>
              setTooltipFromPointer(
                event,
                trafficTooltip(countryDisplayName(slices[0]?.label ?? ""), slices[0]?.count ?? 0, total),
                setTooltip
              )
            }
            onPointerEnter={(event) =>
              setTooltipFromPointer(
                event,
                trafficTooltip(countryDisplayName(slices[0]?.label ?? ""), slices[0]?.count ?? 0, total),
                setTooltip
              )
            }
            onPointerLeave={() => setTooltip(null)}
            onPointerMove={(event) =>
              setTooltipFromPointer(
                event,
                trafficTooltip(countryDisplayName(slices[0]?.label ?? ""), slices[0]?.count ?? 0, total),
                setTooltip
              )
            }
            r={94}
            tabIndex={0}
          />
        ) : null}
        {!single
          ? slices.map((slice) => {
              const tooltipLabel = trafficTooltip(countryDisplayName(slice.label), slice.count, total);
              return (
                <path
                  aria-label={tooltipLabel}
                  data-chart-tooltip={tooltipLabel}
                  d={arcPath(120, 120, 94, slice.start, slice.end)}
                  fill={slice.color}
                  key={slice.label}
                  onMouseEnter={(event) => setTooltipFromPointer(event, tooltipLabel, setTooltip)}
                  onMouseLeave={() => setTooltip(null)}
                  onMouseMove={(event) => setTooltipFromPointer(event, tooltipLabel, setTooltip)}
                  onPointerEnter={(event) => setTooltipFromPointer(event, tooltipLabel, setTooltip)}
                  onPointerLeave={() => setTooltip(null)}
                  onPointerMove={(event) => setTooltipFromPointer(event, tooltipLabel, setTooltip)}
                  tabIndex={0}
                />
              );
            })
          : null}
        {slices.map((slice) => {
          if (slice.count / total < 0.08) return null;
          const mid = slice.start + (slice.end - slice.start) / 2;
          const labelPoint = polarToCartesian(120, 120, 60, mid);
          return (
            <text x={labelPoint.x} y={labelPoint.y} textAnchor="middle" dominantBaseline="middle" key={`${slice.label}-label`}>
              {slice.label}
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
  );
}

function CountryList({ rows, total }: { rows: CountryCount[]; total: number }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const visibleRows = expanded ? rows : rows.slice(0, 5);

  if (!rows.length) return <p className="muted">No location data yet.</p>;

  return (
    <>
      <div className="country-list" id={listId} aria-label={expanded ? "All country details" : "Top country details"}>
        {visibleRows.map((row) => {
          const code = normalizeCountryCode(row.label);
          const tooltip = trafficTooltip(countryDisplayName(code), row.count, total);
          return (
            <div className="country-row chart-tooltip-anchor" data-tooltip={tooltip} key={row.label} tabIndex={0} title={tooltip}>
              <span className="country-flag" aria-hidden>{countryFlag(code)}</span>
              <strong>
                {code} ({countryName(code)}): {hitLabel(row.count)}
              </strong>
            </div>
          );
        })}
      </div>
      {rows.length > 5 ? (
        <button
          aria-controls={listId}
          aria-expanded={expanded}
          className="button secondary country-list-toggle"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? "Show top 5" : `View more (${rows.length - 5})`}
        </button>
      ) : null}
    </>
  );
}

function WorldTrafficMap({ rows }: { rows: CountryCount[] }) {
  const width = 900;
  const height = 380;
  const projection = geoNaturalEarth1().fitExtent(
    [
      [10, 10],
      [width - 10, height - 30]
    ],
    { type: "Sphere" }
  );
  const path = geoPath(projection);
  const countsByNumericCode = new Map(
    rows.flatMap((row) => {
      const numeric = numericCountryCode(normalizeCountryCode(row.label));
      return numeric ? [[numeric, row.count] as const] : [];
    })
  );
  const values = Array.from(countsByNumericCode.values());
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const [tooltip, setTooltip] = useState<MapTooltipState | null>(null);

  return (
    <div className="world-map-wrap" onMouseLeave={() => setTooltip(null)}>
      <svg className="world-map" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Overall country traffic map">
        <rect width={width} height={height} />
        {countryFeatures.features.map((country) => {
          const countryId = String((country as CountryFeature).id ?? "").padStart(3, "0");
          const count = countsByNumericCode.get(countryId) ?? 0;
          const d = path(country);
          if (!d) return null;
          const alpha2 = countries.numericToAlpha2(countryId);
          const code = alpha2 ?? countryId;
          const displayName = numericCountryDisplayName(countryId, country.properties?.name ?? countryId);
          const percentage = percentageLabel(count, total);
          const label = trafficTooltip(displayName, count, total);
          const mapTooltip = { count, label };
          return (
            <path
              aria-label={label}
              className={`map-country ${count > 0 ? "has-traffic" : ""} ${mapBucket(count, max)}`}
              data-chart-tooltip={label}
              data-map-code={code}
              data-map-count={count}
              data-map-percentage={percentage}
              d={d}
              key={countryId}
              onMouseEnter={(event) => setMapTooltipFromPointer(event, mapTooltip, setTooltip)}
              onMouseLeave={() => setTooltip(null)}
              onMouseMove={(event) => setMapTooltipFromPointer(event, mapTooltip, setTooltip)}
              onPointerEnter={(event) => setMapTooltipFromPointer(event, mapTooltip, setTooltip)}
              onPointerLeave={() => setTooltip(null)}
              onPointerMove={(event) => setMapTooltipFromPointer(event, mapTooltip, setTooltip)}
              tabIndex={0}
            />
          );
        })}
      </svg>
      {tooltip ? (
        <div className="map-tooltip" role="status" style={{ left: tooltip.x, top: tooltip.y }}>
          <strong>{tooltip.label}</strong>
        </div>
      ) : null}
      <div className="map-legend" aria-label={`Traffic scale from ${min} to ${max} hits`}>
        <span>{min}</span>
        <span className="legend-ramp" aria-hidden>
          {tooltip && tooltip.count > 0 ? (
            <span
              className="legend-marker"
              style={{ left: `${legendMarkerPercent(tooltip.count, min, max)}%` }}
            >
              <span className="legend-marker-label">{tooltip.count}</span>
            </span>
          ) : null}
        </span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export function LocationCharts({ rows }: { rows: CountryCount[] }) {
  const countryRows = rows.filter((row) => normalizeCountryCode(row.label) !== "UNKNOWN" && row.count > 0);
  const total = countryRows.reduce((sum, row) => sum + row.count, 0);

  if (!countryRows.length) {
    return (
      <div className="stats-card">
        <h2>Location</h2>
        <p className="muted">No location data yet.</p>
      </div>
    );
  }

  return (
    <div className="location-analytics-grid">
      <div className="location-card">
        <h2>Top 5 countries</h2>
        <div className="country-pie-wrap">
          <CountryPie rows={countryRows} />
        </div>
        <p className="muted">Click for more details</p>
        <CountryList rows={countryRows} total={total} />
      </div>
      <div className="location-card location-map-card">
        <h2>Overall traffic</h2>
        <WorldTrafficMap rows={countryRows} />
      </div>
    </div>
  );
}
