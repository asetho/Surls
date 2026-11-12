import { isIP } from "node:net";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { decryptSecret, encryptSecret } from "./crypto";
import { env } from "./env";
import { prisma } from "./prisma";
import { verifySmtpCheckProof } from "./smtp-check-proof";

const SMTP_SETTING_KEY = "smtp";
type SmtpClient = Pick<Prisma.TransactionClient, "appSetting">;

type StoredSmtpSettings = {
  host: string;
  port: number;
  from: string;
  fromName?: string;
  username: string;
  passwordEncrypted: string;
};

export type SmtpSettingsSummary = {
  host: string;
  port: number;
  from: string;
  fromName: string;
  username: string;
  hasPassword: boolean;
  source: "settings" | "environment" | "none";
};

export type SmtpTransportConfig = {
  host: string;
  port: number;
  from: string;
  fromName: string;
  username: string;
  password: string;
};

export class SmtpSettingsError extends Error {}

function storedSmtpSettings(value: unknown): StoredSmtpSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.host !== "string" || typeof record.port !== "number" ||
      typeof record.from !== "string" || typeof record.username !== "string" ||
      (record.fromName !== undefined && typeof record.fromName !== "string") ||
      typeof record.passwordEncrypted !== "string") return null;
  return record as StoredSmtpSettings;
}

function environmentSmtpSettings(): SmtpTransportConfig | null {
  if (!env.SMTP_HOST || !env.SMTP_FROM) return null;
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    from: env.SMTP_FROM,
    fromName: "",
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
      fromName: saved?.fromName ?? "",
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
    fromName: fallback?.fromName ?? "",
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
      fromName: saved.fromName ?? "",
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

async function resolveSmtpForm(formData: FormData, client: SmtpClient) {
  const host = field(formData.get("host"), "SMTP host", 253);
  const senderEmail = field(formData.get("from"), "sender email", 320);
  const fromName = field(formData.get("fromName") ?? "", "From name", 100);
  const username = field(formData.get("username") ?? "", "SMTP username", 320);
  const passwordValue = formData.get("password") ?? "";
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
  const from = senderEmail || (z.email().safeParse(username).success ? username : "");
  if (senderEmail && !z.email().safeParse(senderEmail).success) throw new SmtpSettingsError("Enter a valid sender email address.");
  if (!host && (senderEmail || fromName || username || newPassword)) throw new SmtpSettingsError("Enter an SMTP host or clear all fields to disable email.");
  if (!username && newPassword) throw new SmtpSettingsError("Enter an SMTP username with the password.");
  if (host && !from) throw new SmtpSettingsError("Enter a sender email address or use an email address as the username.");

  const current = await client.appSetting.findUnique({ where: { key: SMTP_SETTING_KEY } });
  const saved = storedSmtpSettings(current?.value);
  const fallback = current ? null : environmentSmtpSettings();
  let passwordEncrypted = "";
  let password = "";
  if (username) {
    if (newPassword) {
      password = newPassword;
      passwordEncrypted = encryptSecret(newPassword);
    }
    else if (saved?.host === host && saved.port === port && saved.username === username && saved.passwordEncrypted) {
      try {
        password = decryptSecret(saved.passwordEncrypted);
      } catch {
        throw new SmtpSettingsError("Enter a new SMTP password; the saved password cannot be read.");
      }
      passwordEncrypted = saved.passwordEncrypted;
    } else if (fallback?.host === host && fallback.port === port && fallback.username === username && fallback.password) {
      password = fallback.password;
      passwordEncrypted = encryptSecret(fallback.password);
    } else {
      throw new SmtpSettingsError("Enter the SMTP password when the host, port, or username changes.");
    }
  }
  return { host, port, from, fromName, username, password, passwordEncrypted };
}

export async function getSmtpSettingsCheckConfig(formData: FormData, client: SmtpClient = prisma): Promise<SmtpTransportConfig> {
  const { host, port, from, fromName, username, password } = await resolveSmtpForm(formData, client);
  return { host, port, from, fromName, username, password };
}

export async function getSmtpConnectionTestConfig(formData: FormData, client: SmtpClient = prisma): Promise<SmtpTransportConfig> {
  const config = await getSmtpSettingsCheckConfig(formData, client);
  const { host } = config;
  if (!host) throw new SmtpSettingsError("Enter an SMTP host to check the connection.");
  return config;
}

async function persistSmtpSettings(
  { host, port, from, fromName, username, passwordEncrypted }: Awaited<ReturnType<typeof resolveSmtpForm>>,
  client: SmtpClient
) {
  const value: StoredSmtpSettings = { host, port, from, fromName, username, passwordEncrypted };
  await client.appSetting.upsert({
    where: { key: SMTP_SETTING_KEY },
    create: { key: SMTP_SETTING_KEY, value: value as Prisma.InputJsonValue },
    update: { value: value as Prisma.InputJsonValue }
  });
  return { enabled: Boolean(host), authenticated: Boolean(username) };
}

export async function saveSmtpSettings(formData: FormData, client: SmtpClient = prisma) {
  return persistSmtpSettings(await resolveSmtpForm(formData, client), client);
}

export async function saveCheckedSmtpSettings(formData: FormData, adminId: string, proof: unknown, client: SmtpClient = prisma) {
  const resolved = await resolveSmtpForm(formData, client);
  const { host, port, from, fromName, username, password } = resolved;
  if (!verifySmtpCheckProof(proof, adminId, { host, port, from, fromName, username, password })) {
    throw new SmtpSettingsError("Check these SMTP settings before saving. Checks expire after five minutes.");
  }
  return persistSmtpSettings(resolved, client);
}

export async function restoreEnvironmentSmtpSettings(client: SmtpClient = prisma) {
  await client.appSetting.deleteMany({ where: { key: SMTP_SETTING_KEY } });
}
