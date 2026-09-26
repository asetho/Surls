import { isIP } from "node:net";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { decryptSecret, encryptSecret } from "./crypto";
import { env } from "./env";
import { prisma } from "./prisma";

const SMTP_SETTING_KEY = "smtp";
type SmtpClient = Pick<Prisma.TransactionClient, "appSetting">;

type StoredSmtpSettings = {
  host: string;
  port: number;
  from: string;
  username: string;
  passwordEncrypted: string;
};

export type SmtpSettingsSummary = {
  host: string;
  port: number;
  from: string;
  username: string;
  hasPassword: boolean;
  source: "settings" | "environment" | "none";
};

export type SmtpTransportConfig = {
  host: string;
  port: number;
  from: string;
  username: string;
  password: string;
};

export class SmtpSettingsError extends Error {}

function storedSmtpSettings(value: unknown): StoredSmtpSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.host !== "string" || typeof record.port !== "number" ||
      typeof record.from !== "string" || typeof record.username !== "string" ||
      typeof record.passwordEncrypted !== "string") return null;
  return record as StoredSmtpSettings;
}

function environmentSmtpSettings(): SmtpTransportConfig | null {
  if (!env.SMTP_HOST || !env.SMTP_FROM) return null;
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    from: env.SMTP_FROM,
    username: env.SMTP_USER ?? "",
    password: env.SMTP_PASSWORD ?? ""
  };
}

export async function getSmtpSettingsSummary(client: SmtpClient = prisma): Promise<SmtpSettingsSummary> {
  const row = await client.appSetting.findUnique({ where: { key: SMTP_SETTING_KEY } });
  if (row) {
    const saved = storedSmtpSettings(row.value);
    return {
      host: saved?.host ?? "",
      port: saved?.port ?? 587,
      from: saved?.from ?? "",
      username: saved?.username ?? "",
      hasPassword: Boolean(saved?.passwordEncrypted),
      source: "settings"
    };
  }
  const fallback = environmentSmtpSettings();
  return {
    host: fallback?.host ?? "",
    port: fallback?.port ?? 587,
    from: fallback?.from ?? "",
    username: fallback?.username ?? "",
    hasPassword: Boolean(fallback?.password),
    source: fallback ? "environment" : "none"
  };
}

export async function getSmtpTransportConfig(client: SmtpClient = prisma): Promise<SmtpTransportConfig | null> {
  const row = await client.appSetting.findUnique({ where: { key: SMTP_SETTING_KEY } });
  if (!row) return environmentSmtpSettings();
  const saved = storedSmtpSettings(row.value);
  if (!saved?.host || !saved.from || Boolean(saved.username) !== Boolean(saved.passwordEncrypted)) return null;
  try {
    return {
      host: saved.host,
      port: saved.port,
      from: saved.from,
      username: saved.username,
      password: saved.passwordEncrypted ? decryptSecret(saved.passwordEncrypted) : ""
    };
  } catch {
    return null;
  }
}

function field(value: FormDataEntryValue | null, label: string, maxLength: number) {
  if (typeof value !== "string") throw new SmtpSettingsError(`Enter a valid ${label}.`);
  const text = value.trim();
  if (text.length > maxLength || /[\r\n\0]/.test(text)) throw new SmtpSettingsError(`Enter a valid ${label}.`);
  return text;
}

export async function saveSmtpSettings(formData: FormData, client: SmtpClient = prisma) {
  const host = field(formData.get("host"), "SMTP host", 253);
  const from = field(formData.get("from"), "sender email", 320);
  const username = field(formData.get("username"), "SMTP username", 320);
  const passwordValue = formData.get("password");
  if (typeof passwordValue !== "string" || passwordValue.length > 4096 || /[\r\n\0]/.test(passwordValue)) {
    throw new SmtpSettingsError("Enter a valid SMTP password.");
  }
  const newPassword = passwordValue;
  const portValue = field(formData.get("port"), "SMTP port", 5);
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new SmtpSettingsError("Enter an SMTP port from 1 to 65535.");
  if (host && !isIP(host) && !/^(?=.{1,253}$)[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(host)) {
    throw new SmtpSettingsError("Enter a valid SMTP host without a URL scheme or port.");
  }
  if (host && !z.email().safeParse(from).success) throw new SmtpSettingsError("Enter a valid sender email address.");
  if (!host && (from || username || newPassword)) throw new SmtpSettingsError("Enter an SMTP host or clear all fields to disable email.");
  if (host && !from) throw new SmtpSettingsError("Enter a sender email address.");
  if (!username && newPassword) throw new SmtpSettingsError("Enter an SMTP username with the password.");

  const current = await client.appSetting.findUnique({ where: { key: SMTP_SETTING_KEY } });
  const saved = storedSmtpSettings(current?.value);
  const fallback = current ? null : environmentSmtpSettings();
  let passwordEncrypted = "";
  if (username) {
    if (newPassword) passwordEncrypted = encryptSecret(newPassword);
    else if (saved?.host === host && saved.port === port && saved.username === username && saved.passwordEncrypted) {
      try {
        decryptSecret(saved.passwordEncrypted);
      } catch {
        throw new SmtpSettingsError("Enter a new SMTP password; the saved password cannot be read.");
      }
      passwordEncrypted = saved.passwordEncrypted;
    } else if (fallback?.host === host && fallback.port === port && fallback.username === username && fallback.password) {
      passwordEncrypted = encryptSecret(fallback.password);
    } else {
      throw new SmtpSettingsError("Enter the SMTP password when the host, port, or username changes.");
    }
  }
  const value: StoredSmtpSettings = { host, port, from, username, passwordEncrypted };
  await client.appSetting.upsert({
    where: { key: SMTP_SETTING_KEY },
    create: { key: SMTP_SETTING_KEY, value: value as Prisma.InputJsonValue },
    update: { value: value as Prisma.InputJsonValue }
  });
  return { enabled: Boolean(host), authenticated: Boolean(username) };
}

export async function restoreEnvironmentSmtpSettings(client: SmtpClient = prisma) {
  await client.appSetting.deleteMany({ where: { key: SMTP_SETTING_KEY } });
}
