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

export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function normalizeDisplayTimeZone(value: unknown) {
  const timeZone = typeof value === "string" ? value.trim() : "";
  return timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_DISPLAY_TIME_ZONE;
}

export function requireDisplayTimeZone(value: unknown) {
  const timeZone = typeof value === "string" ? value.trim() : "";
  if (!timeZone || !isValidTimeZone(timeZone)) {
    throw new Error("Invalid display timezone.");
  }
  return timeZone;
}

export function formatDateTime(date: Date, timeZone = DEFAULT_DISPLAY_TIME_ZONE) {
  const parts = partMap(
    new Intl.DateTimeFormat("en-US", {
      timeZone: normalizeDisplayTimeZone(timeZone),
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).formatToParts(date)
  );

  return `${parts.month} ${parts.day}, ${parts.year} ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
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
