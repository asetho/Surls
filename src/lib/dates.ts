export const DEFAULT_DISPLAY_TIME_ZONE = "America/New_York";

export const COMMON_DISPLAY_TIME_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC"
];

const DAY_MS = 24 * 60 * 60 * 1000;

function partMap(parts: Intl.DateTimeFormatPart[]) {
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function timeZoneString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function normalizeOptionalDisplayTimeZone(value: unknown) {
  const timeZone = timeZoneString(value);
  return timeZone && isValidTimeZone(timeZone) ? timeZone : null;
}

export function normalizeDisplayTimeZone(value: unknown) {
  return normalizeOptionalDisplayTimeZone(value) ?? DEFAULT_DISPLAY_TIME_ZONE;
}

export function requireDisplayTimeZone(value: unknown) {
  const timeZone = normalizeOptionalDisplayTimeZone(value);
  if (!timeZone) {
    throw new Error("Invalid display timezone.");
  }
  return timeZone;
}

export function requireOptionalDisplayTimeZone(value: unknown) {
  const timeZone = timeZoneString(value);
  if (!timeZone) return null;
  if (!isValidTimeZone(timeZone)) {
    throw new Error("Invalid display timezone.");
  }
  return timeZone;
}

export function resolveDisplayTimeZone(userTimeZone: unknown, siteDefaultTimeZone: unknown) {
  return (
    normalizeOptionalDisplayTimeZone(userTimeZone) ??
    normalizeOptionalDisplayTimeZone(siteDefaultTimeZone) ??
    DEFAULT_DISPLAY_TIME_ZONE
  );
}

export function formatDateTime(date: Date, timeZone = DEFAULT_DISPLAY_TIME_ZONE) {
  const parts = partMap(
    new Intl.DateTimeFormat("en-US", {
      timeZone: normalizeDisplayTimeZone(timeZone),
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }).formatToParts(date)
  );

  return `${parts.month}/${parts.day}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second} ${parts.dayPeriod}`;
}

export function dateKeyForTimeZone(date: Date, timeZone = DEFAULT_DISPLAY_TIME_ZONE) {
  const parts = partMap(
    new Intl.DateTimeFormat("en-US", {
      timeZone: normalizeDisplayTimeZone(timeZone),
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date)
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function zonedDateTimeParts(date: Date, timeZone: string) {
  const parts = partMap(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date)
  );

  return {
    day: Number.parseInt(parts.day, 10),
    hour: Number.parseInt(parts.hour, 10),
    minute: Number.parseInt(parts.minute, 10),
    month: Number.parseInt(parts.month, 10),
    second: Number.parseInt(parts.second, 10),
    year: Number.parseInt(parts.year, 10)
  };
}

function utcDateForZonedParts(
  timeZone: string,
  parts: { day: number; hour: number; minute: number; month: number; second: number; year: number }
) {
  const targetAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let utc = targetAsUtc;

  for (let index = 0; index < 3; index += 1) {
    const actual = zonedDateTimeParts(new Date(utc), timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    const delta = targetAsUtc - actualAsUtc;
    if (delta === 0) break;
    utc += delta;
  }

  return new Date(utc);
}

export function startOfDayInTimeZone(date: Date, timeZone = DEFAULT_DISPLAY_TIME_ZONE) {
  const normalizedTimeZone = normalizeDisplayTimeZone(timeZone);
  const parts = zonedDateTimeParts(date, normalizedTimeZone);
  return utcDateForZonedParts(normalizedTimeZone, { ...parts, hour: 0, minute: 0, second: 0 });
}

function dateKeyToUtcDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(year, month - 1, day));
}

export function enumerateDateKeys(startKey: string, endKey: string) {
  const start = dateKeyToUtcDate(startKey).getTime();
  const end = dateKeyToUtcDate(endKey).getTime();
  const totalDays = Math.max(0, Math.round((end - start) / DAY_MS));

  return Array.from({ length: totalDays + 1 }, (_, index) => {
    const date = new Date(start + index * DAY_MS);
    return date.toISOString().slice(0, 10);
  });
}

export function formatDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
