import { prisma } from "./prisma";

export const DEFAULT_SETTINGS = {
  siteName: "Surls",
  trackAdminClicks: false,
  preserveRedirectQuery: false,
  enablePasswordProtectedLinks: true,
  enableQrCodes: true,
  themeDefault: "auto"
} satisfies Record<string, unknown>;

export type AppSettings = typeof DEFAULT_SETTINGS;

export async function getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
  const setting = await prisma.appSetting.findUnique({ where: { key } });
  return (setting?.value as AppSettings[K] | undefined) ?? DEFAULT_SETTINGS[key];
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.appSetting.findMany();
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return Object.fromEntries(
    Object.entries(DEFAULT_SETTINGS).map(([key, defaultValue]) => [key, values.get(key) ?? defaultValue])
  ) as AppSettings;
}

export async function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  return prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
}
