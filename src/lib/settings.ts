import { prisma } from "./prisma";
import { env } from "./env";
import { DEFAULT_DISPLAY_TIME_ZONE, normalizeDisplayTimeZone } from "./dates";

export const DEFAULT_SETTINGS = {
  siteName: env.APP_NAME,
  displayTimeZone: DEFAULT_DISPLAY_TIME_ZONE,
  trackAdminClicks: false,
  preserveRedirectQuery: false,
  enablePasswordProtectedLinks: true,
  enableQrCodes: true,
  themeDefault: "auto"
} satisfies Record<string, unknown>;

export type AppSettings = typeof DEFAULT_SETTINGS;

export function normalizeSiteName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  return name || env.APP_NAME || "Surls";
}

export async function getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
  const setting = await prisma.appSetting.findUnique({ where: { key } });
  return (setting?.value as AppSettings[K] | undefined) ?? DEFAULT_SETTINGS[key];
}

export async function getSiteName() {
  try {
    return normalizeSiteName(await getSetting("siteName"));
  } catch {
    return normalizeSiteName(null);
  }
}

export async function getDisplayTimeZone() {
  try {
    return normalizeDisplayTimeZone(await getSetting("displayTimeZone"));
  } catch {
    return DEFAULT_DISPLAY_TIME_ZONE;
  }
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.appSetting.findMany();
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const settings = Object.fromEntries(
    Object.entries(DEFAULT_SETTINGS).map(([key, defaultValue]) => [key, values.get(key) ?? defaultValue])
  ) as AppSettings;
  return {
    ...settings,
    siteName: normalizeSiteName(settings.siteName),
    displayTimeZone: normalizeDisplayTimeZone(settings.displayTimeZone)
  };
}

export async function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  return prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
}
