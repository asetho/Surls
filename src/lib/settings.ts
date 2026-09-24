import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { env } from "./env";
import { DEFAULT_DISPLAY_TIME_ZONE, normalizeDisplayTimeZone } from "./dates";
import { normalizeCustomHtmlPage } from "./custom-pages";
import {
  DEFAULT_DASHBOARD_THEME,
  normalizeDashboardTheme,
  type DashboardTheme
} from "./dashboard-theme";
import { normalizeFavicons, type StoredFavicons } from "./favicons";

export type CustomHtmlPage = {
  fileName: string;
  html: string;
  size: number;
  updatedAt: string;
};

export type AppSettings = {
  siteName: string;
  displayTimeZone: string;
  trackAdminClicks: boolean;
  preserveRedirectQuery: boolean;
  localLoginEnabled: boolean;
  externalAutoProvisionUsers: boolean;
  uploadMaxBytes: number | null;
  enablePasswordProtectedLinks: boolean;
  enableQrCodes: boolean;
  themeDefault: "auto" | "light" | "dark";
  dashboardTheme: DashboardTheme;
  customIndexPage: CustomHtmlPage | null;
  customNotFoundPage: CustomHtmlPage | null;
  customLoginPage: CustomHtmlPage | null;
  favicons: StoredFavicons | null;
};

export const DEFAULT_SETTINGS: AppSettings = {
  siteName: env.APP_NAME,
  displayTimeZone: DEFAULT_DISPLAY_TIME_ZONE,
  trackAdminClicks: false,
  preserveRedirectQuery: false,
  localLoginEnabled: true,
  externalAutoProvisionUsers: false,
  uploadMaxBytes: env.UPLOAD_MAX_BYTES,
  enablePasswordProtectedLinks: true,
  enableQrCodes: true,
  themeDefault: "auto",
  dashboardTheme: DEFAULT_DASHBOARD_THEME,
  customIndexPage: null,
  customNotFoundPage: null,
  customLoginPage: null,
  favicons: null
};

export function normalizeSiteName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  return name || env.APP_NAME || "Surls";
}

export async function getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
  const setting = await prisma.appSetting.findUnique({ where: { key } });
  return setting ? (setting.value as AppSettings[K]) : DEFAULT_SETTINGS[key];
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

export function normalizeSiteUploadMaxBytes(value: unknown) {
  if (value === null) return null;
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : DEFAULT_SETTINGS.uploadMaxBytes;
}

export async function getSiteUploadMaxBytes() {
  try {
    return normalizeSiteUploadMaxBytes(await getSetting("uploadMaxBytes"));
  } catch {
    return DEFAULT_SETTINGS.uploadMaxBytes;
  }
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.appSetting.findMany();
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const settings = Object.fromEntries(
    Object.entries(DEFAULT_SETTINGS).map(([key, defaultValue]) => [key, values.has(key) ? values.get(key) : defaultValue])
  ) as AppSettings;
  return {
    ...settings,
    siteName: normalizeSiteName(settings.siteName),
    displayTimeZone: normalizeDisplayTimeZone(settings.displayTimeZone),
    uploadMaxBytes: normalizeSiteUploadMaxBytes(settings.uploadMaxBytes),
    dashboardTheme: normalizeDashboardTheme(settings.dashboardTheme),
    customIndexPage: normalizeCustomHtmlPage(settings.customIndexPage),
    customNotFoundPage: normalizeCustomHtmlPage(settings.customNotFoundPage),
    customLoginPage: normalizeCustomHtmlPage(settings.customLoginPage),
    favicons: normalizeFavicons(settings.favicons)
  };
}

export function settingJsonValue(value: AppSettings[keyof AppSettings]) {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

export async function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  const jsonValue = settingJsonValue(value);
  return prisma.appSetting.upsert({
    where: { key },
    update: { value: jsonValue },
    create: { key, value: jsonValue }
  });
}
