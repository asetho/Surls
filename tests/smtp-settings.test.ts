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

  it("uses an email username as the sender address and saves an optional From name", async () => {
    const { getSmtpSettingsSummary, getSmtpTransportConfig, saveSmtpSettings } = await import("@/lib/smtp-settings");
    await saveSmtpSettings(form({ host: "mail.example.com", port: "587", from: "", fromName: "Surls Share", username: "sender@example.com", password: "secret" }));
    expect(await getSmtpSettingsSummary()).toMatchObject({ from: "sender@example.com", fromName: "Surls Share" });
    expect(await getSmtpTransportConfig()).toMatchObject({ from: "sender@example.com", fromName: "Surls Share" });
  });

  it("checks entered settings without saving and reuses only a matching saved password", async () => {
    const { getSmtpConnectionTestConfig, saveSmtpSettings, SmtpSettingsError } = await import("@/lib/smtp-settings");
    const values = { host: "mail.example.com", port: "587", from: "", username: "sender@example.com", password: "secret" };
    expect(await getSmtpConnectionTestConfig(form(values))).toMatchObject({ from: "sender@example.com", password: "secret" });
    expect(appSetting.upsert).not.toHaveBeenCalled();

    await saveSmtpSettings(form(values));
    vi.mocked(appSetting.upsert).mockClear();
    expect(await getSmtpConnectionTestConfig(form({ ...values, password: "" }))).toMatchObject({ password: "secret" });
    await expect(getSmtpConnectionTestConfig(form({ ...values, host: "other.example.com", password: "" })))
      .rejects.toBeInstanceOf(SmtpSettingsError);
    expect(appSetting.upsert).not.toHaveBeenCalled();
  });

  it("requires a matching successful check before saving, including when disabling delivery", async () => {
    const { getSmtpSettingsCheckConfig, getSmtpTransportConfig, saveCheckedSmtpSettings } = await import("@/lib/smtp-settings");
    const { createSmtpCheckProof } = await import("@/lib/smtp-check-proof");
    const values = { host: "mail.example.com", port: "587", from: "sender@example.com", fromName: "Surls",
      username: "sender@example.com", password: "secret" };
    const input = form(values);
    const config = await getSmtpSettingsCheckConfig(input);
    const { proof } = createSmtpCheckProof("admin_1", config);
    await expect(saveCheckedSmtpSettings(input, "admin_1", "")).rejects.toThrow("Check these SMTP settings");
    await expect(saveCheckedSmtpSettings(form({ ...values, fromName: "Changed" }), "admin_1", proof))
      .rejects.toThrow("Check these SMTP settings");
    expect(appSetting.upsert).not.toHaveBeenCalled();
    await saveCheckedSmtpSettings(input, "admin_1", proof);
    expect(await getSmtpTransportConfig()).toMatchObject({ host: values.host, fromName: values.fromName });

    const disabled = form({ host: "", port: "587", from: "", fromName: "", username: "", password: "" });
    const emptyConfig = await getSmtpSettingsCheckConfig(disabled);
    expect(emptyConfig.host).toBe("");
    const emptyProof = createSmtpCheckProof("admin_1", emptyConfig).proof;
    await saveCheckedSmtpSettings(disabled, "admin_1", emptyProof);
    expect(await getSmtpTransportConfig()).toBeNull();
  });

  it("accepts an unauthenticated relay while requiring paired login credentials and an addressable sender", async () => {
    const { getSmtpConnectionTestConfig, saveSmtpSettings, SmtpSettingsError } = await import("@/lib/smtp-settings");
    await saveSmtpSettings(form({ host: "mail.example.com", port: "587", from: "sender@example.com", username: "", password: "" }));
    expect(await getSmtpConnectionTestConfig(form({ host: "mail.example.com", port: "587", from: "sender@example.com" })))
      .toMatchObject({ username: "", password: "" });
    vi.mocked(appSetting.upsert).mockClear();
    await expect(saveSmtpSettings(form({ host: "mail.example.com", port: "587", from: "sender@example.com", username: "", password: "secret" })))
      .rejects.toThrow("Enter an SMTP username with the password.");
    await expect(getSmtpConnectionTestConfig(form({ host: "mail.example.com", port: "587", from: "", username: "mailer", password: "secret" })))
      .rejects.toThrow("Enter a sender email address or use an email address as the username.");
    await expect(getSmtpConnectionTestConfig(form({ host: "mail.example.com", port: "587", from: "", username: "sender@example.com", password: "" })))
      .rejects.toBeInstanceOf(SmtpSettingsError);
    expect(appSetting.upsert).not.toHaveBeenCalled();
  });
});
