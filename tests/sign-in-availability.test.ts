import { beforeEach, describe, expect, it, vi } from "vitest";

type Transaction = { locked: boolean; externalIdentity: { findMany: () => Promise<{ provider: string }[]> } };
const state = vi.hoisted(() => ({
  providers: new Set<string>(), local: false, external: true, identities: [] as { provider: string }[],
  tail: Promise.resolve(),
  requireLock(client: unknown) {
    if (!(client as Transaction | undefined)?.locked) throw new Error("Availability access escaped the locked transaction");
  }
}));

// Model PostgreSQL's transaction-scoped advisory lock, while exercising the real
// transaction helper and both server-action modules against overlapping calls.
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: async (operation: (transaction: Transaction) => Promise<unknown>) => {
    let release: (() => void) | undefined;
    const transaction = {
      locked: false,
      $executeRaw: async (sql: TemplateStringsArray) => {
        expect(sql.join("?")).toContain("pg_advisory_xact_lock");
        const previous = state.tail;
        state.tail = new Promise<void>((resolve) => { release = resolve; });
        await previous;
        transaction.locked = true;
      },
      externalIdentity: { findMany: async () => {
        state.requireLock(transaction);
        return state.identities;
      } }
    };
    try { return await operation(transaction); }
    finally { transaction.locked = false; release?.(); }
  }
} }));
vi.mock("@/lib/auth", () => ({ requireSiteAdmin: async () => ({ id: "admin" }) }));
vi.mock("@/lib/csrf", () => ({ validateCsrf: () => {} }));
vi.mock("@/lib/audit", () => ({ auditLog: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(path); } }));
vi.mock("@/lib/admin-toast", () => ({
  adminToastPath: (_path: string, _type: string, message: string) => message,
  adminToastPathFromFormData: (_form: FormData, _type: string, message: string) => message
}));
vi.mock("@/lib/settings", () => ({
  getSetting: async (key: string, client: unknown) => { state.requireLock(client); return key === "localLoginEnabled" ? state.local : state.external; },
  getSettings: async (client: unknown) => { state.requireLock(client); return { localLoginEnabled: state.local, externalLoginEnabled: state.external }; },
  setSetting: async (key: string, value: boolean, client: unknown) => {
    state.requireLock(client);
    if (key === "localLoginEnabled") state.local = value;
    if (key === "externalLoginEnabled") state.external = value;
  }
}));
vi.mock("@/lib/external-provider-settings", () => ({
  isExternalProvider: (key: string) => ["google", "github"].includes(key),
  externalProviderType: (key: string) => key,
  externalProviderKey: (config: { key: string }) => config.key,
  ExternalProviderSettingsError: class extends Error {},
  getConfiguredExternalProviders: async (client: unknown) => {
    state.requireLock(client);
    return [...state.providers].map((key) => ({ key, provider: key }));
  },
  disableExternalProviderSetting: async (key: string, client: unknown) => { state.requireLock(client); state.providers.delete(key); },
  removeExternalProviderSetting: async (key: string, client: unknown) => { state.requireLock(client); state.providers.delete(key); }
}));

function providerForm(provider: string) {
  const form = new FormData();
  form.set("provider", provider);
  return form;
}

async function results(operations: Promise<unknown>[]) {
  return (await Promise.allSettled(operations)).map((result) => result.status === "rejected" ? String(result.reason) : "no redirect");
}

describe("atomic sign-in availability changes", () => {
  beforeEach(() => {
    state.providers = new Set(["google", "github"]);
    state.local = false;
    state.external = true;
    state.identities = [];
    state.tail = Promise.resolve();
  });

  it.each(["remove", "disable"])("keeps one provider during overlapping %s and removal", async (operation) => {
    const actions = await import("@/app/admin/settings/external-provider-actions");
    const first = operation === "remove" ? actions.removeExternalProviderAction : actions.disableExternalProviderAction;
    const messages = await results([first(providerForm("google")), actions.removeExternalProviderAction(providerForm("github"))]);
    expect(state.providers.size).toBe(1);
    expect(messages.filter((message) => message.includes("connect another provider"))).toHaveLength(1);
    expect(messages.filter((message) => /Sign-in provider (removed|disabled)/.test(message))).toHaveLength(1);
  });

  it("allows removing all providers when local sign-in remains enabled", async () => {
    state.local = true;
    const { removeExternalProviderAction } = await import("@/app/admin/settings/external-provider-actions");
    const messages = await results([removeExternalProviderAction(providerForm("google")), removeExternalProviderAction(providerForm("github"))]);
    expect(state.providers.size).toBe(0);
    expect(messages.every((message) => message.includes("Sign-in provider removed"))).toBe(true);
  });

  it.each([true, false])("serializes last-provider removal with local sign-in disable (remove first=%s)", async (removeFirst) => {
    state.providers = new Set(["google"]);
    state.local = true;
    state.identities = [{ provider: "google" }];
    const { removeExternalProviderAction } = await import("@/app/admin/settings/external-provider-actions");
    const { updateSignInMethodsAction } = await import("@/app/admin/settings/actions");
    const remove = () => removeExternalProviderAction(providerForm("google"));
    const disableLocal = () => updateSignInMethodsAction(new FormData());
    const messages = await results(removeFirst ? [remove(), disableLocal()] : [disableLocal(), remove()]);
    expect(state.local || (state.external && state.providers.size > 0)).toBe(true);
    expect(messages.filter((message) => /Sign-in provider removed|Sign-in methods saved/.test(message))).toHaveLength(1);
    expect(messages.filter((message) => /Connect and test|connect another provider/.test(message))).toHaveLength(1);
  });

  it.each([true, false])("prevents overlapping toggles from disabling both login methods (external first=%s)", async (externalFirst) => {
    state.local = true;
    state.identities = [{ provider: "google" }];
    const { setExternalLoginEnabledAction } = await import("@/app/admin/settings/external-provider-actions");
    const { updateSignInMethodsAction } = await import("@/app/admin/settings/actions");
    const form = new FormData();
    form.set("enabled", "false");
    const disableExternal = () => setExternalLoginEnabledAction(form);
    const disableLocal = () => updateSignInMethodsAction(new FormData());
    const messages = await results(externalFirst ? [disableExternal(), disableLocal()] : [disableLocal(), disableExternal()]);
    expect(state.local || state.external).toBe(true);
    expect(messages.filter((message) => /External sign-in disabled|Sign-in methods saved/.test(message))).toHaveLength(1);
    expect(messages.filter((message) => /Enable external sign-in|Enable password and passkey sign-in/.test(message))).toHaveLength(1);
  });
});
