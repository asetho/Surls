import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ row: null as { key: string; value: unknown } | null }));
const appSetting = vi.hoisted(() => ({
  findUnique: vi.fn(async () => state.row),
  upsert: vi.fn(async ({ create, update }: { create: { key: string; value: unknown }; update: { value: unknown } }) => {
    state.row = { key: create.key, value: state.row ? update.value : create.value };
    return state.row;
  }),
  deleteMany: vi.fn(async () => { state.row = null; })
}));

vi.mock("@/lib/prisma", () => ({ prisma: { appSetting } }));
vi.mock("@/lib/env", () => ({ env: {
  AUTH_SECRET: "test-only-test-only-test-only-test-only",
  SMTP_HOST: "environment.example.com", SMTP_PORT: 587,
  SMTP_FROM: "environment@example.com", SMTP_USER: "env-user", SMTP_PASSWORD: "env-password"
} }));

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("SMTP settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.row = null;
  });

  it("falls back to environment settings until a saved override exists", async () => {
    const { getSmtpTransportConfig, saveSmtpSettings } = await import("@/lib/smtp-settings");
    expect(await getSmtpTransportConfig()).toMatchObject({ host: "environment.example.com", password: "env-password" });
    await saveSmtpSettings(form({ host: "", port: "587", from: "", username: "", password: "" }));
    expect(await getSmtpTransportConfig()).toBeNull();
  });

  it("encrypts a new password, hides it from the form, and keeps it on a blank password save", async () => {
    const { getSmtpSettingsSummary, getSmtpTransportConfig, saveSmtpSettings } = await import("@/lib/smtp-settings");
    const values = { host: "mail.example.com", port: "465", from: "no-reply@example.com", username: "mailer", password: "my secret " };
    await saveSmtpSettings(form(values));
    const first = state.row?.value as { passwordEncrypted: string };
    expect(first.passwordEncrypted).not.toContain("my secret");
    expect(await getSmtpSettingsSummary()).toMatchObject({ source: "settings", hasPassword: true, username: "mailer" });
    expect(await getSmtpTransportConfig()).toMatchObject({ host: "mail.example.com", password: "my secret " });
    await saveSmtpSettings(form({ ...values, password: "" }));
    expect((state.row?.value as { passwordEncrypted: string }).passwordEncrypted).toBe(first.passwordEncrypted);
  });

  it("requires a new password when the username changes", async () => {
    const { saveSmtpSettings, SmtpSettingsError } = await import("@/lib/smtp-settings");
    await expect(saveSmtpSettings(form({ host: "mail.example.com", port: "587", from: "sender@example.com", username: "different", password: "" })))
      .rejects.toBeInstanceOf(SmtpSettingsError);
    expect(appSetting.upsert).not.toHaveBeenCalled();
  });

  it("requires a new password when the saved password cannot be decrypted", async () => {
    const { getSmtpTransportConfig, saveSmtpSettings, SmtpSettingsError } = await import("@/lib/smtp-settings");
    const values = { host: "mail.example.com", port: "587", from: "sender@example.com", username: "mailer", password: "" };
    state.row = { key: "smtp", value: { ...values, port: 587, passwordEncrypted: "unreadable" } };

    await expect(saveSmtpSettings(form(values))).rejects.toThrow(SmtpSettingsError);
    expect(appSetting.upsert).not.toHaveBeenCalled();

    await saveSmtpSettings(form({ ...values, password: "replacement secret" }));
    expect(await getSmtpTransportConfig()).toMatchObject({ password: "replacement secret" });
  });

  it("requires a new password before moving a saved credential to another host or port", async () => {
    const { getSmtpTransportConfig, saveSmtpSettings, SmtpSettingsError } = await import("@/lib/smtp-settings");
    const original = { host: "mail.example.com", port: "587", from: "sender@example.com", username: "mailer", password: "saved secret" };
    await saveSmtpSettings(form(original));
    const saved = state.row?.value;
    vi.mocked(appSetting.upsert).mockClear();

    for (const changes of [{ host: "other.example.com" }, { port: "465" }]) {
      await expect(saveSmtpSettings(form({ ...original, ...changes, password: "" })))
        .rejects.toBeInstanceOf(SmtpSettingsError);
      expect(state.row?.value).toBe(saved);
    }
    expect(appSetting.upsert).not.toHaveBeenCalled();

    await saveSmtpSettings(form({ ...original, host: "other.example.com", password: "new secret" }));
    expect(await getSmtpTransportConfig()).toMatchObject({ host: "other.example.com", password: "new secret" });
  });

  it("only imports the environment password for the original host and port", async () => {
    const { getSmtpTransportConfig, saveSmtpSettings, SmtpSettingsError } = await import("@/lib/smtp-settings");
    const original = { host: "environment.example.com", port: "587", from: "new-sender@example.com", username: "env-user", password: "" };
    for (const changes of [{ host: "other.example.com" }, { port: "465" }]) {
      await expect(saveSmtpSettings(form({ ...original, ...changes })))
        .rejects.toBeInstanceOf(SmtpSettingsError);
    }
    expect(appSetting.upsert).not.toHaveBeenCalled();

    await saveSmtpSettings(form(original));
    expect(await getSmtpTransportConfig()).toMatchObject({ host: original.host, from: original.from, password: "env-password" });
  });
});
