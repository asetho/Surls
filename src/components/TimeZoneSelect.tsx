"use client";

import { COMMON_DISPLAY_TIME_ZONES, normalizeOptionalDisplayTimeZone } from "@/lib/dates";

type TimeZoneSelectProps = {
  className?: string;
  hideLabel?: boolean;
  id?: string;
  label?: string;
  name?: string;
  siteDefaultTimeZone: string;
  value: string | null;
};

export function TimeZoneSelect({
  className,
  hideLabel = false,
  id,
  label = "Display timezone",
  name = "displayTimeZone",
  siteDefaultTimeZone,
  value
}: TimeZoneSelectProps) {
  const selectedTimeZone = normalizeOptionalDisplayTimeZone(value);
  const options = Array.from(
    new Set([siteDefaultTimeZone, ...COMMON_DISPLAY_TIME_ZONES, ...(selectedTimeZone ? [selectedTimeZone] : [])])
  );

  return (
    <label className={className}>
      <span className={hideLabel ? "sr-only" : undefined}>{label}</span>
      <select id={id} name={name} defaultValue={selectedTimeZone ?? ""}>
        <option value="">Use site default ({siteDefaultTimeZone})</option>
        {options.map((timeZone) => (
          <option value={timeZone} key={timeZone}>
            {timeZone}
          </option>
        ))}
      </select>
    </label>
  );
}
