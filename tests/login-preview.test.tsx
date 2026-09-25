import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordLoginForm } from "@/components/PasswordLoginForm";
import LoginDevPage from "@/app/login-dev/page";

const settings = vi.hoisted(() => ({ getSettings: vi.fn(), getSetting: vi.fn() }));
const turnstile = vi.hoisted(() => ({ turnstileSiteKey: vi.fn() }));
vi.mock("@/lib/settings", () => settings);
vi.mock("@/lib/turnstile", () => turnstile);
vi.mock("@/lib/auth", () => ({ requireSiteAdmin: vi.fn(async () => ({ id: "admin" })) }));
vi.mock("@/lib/env", () => ({ env: { SURLS_LOGIN_DEV_ENABLED: true } }));
vi.mock("@/lib/custom-pages", () => ({ pageFromFilesystem: vi.fn(async () => null) }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/external-provider-settings", () => ({
  getConfiguredExternalProviders: vi.fn(async () => [
    { key: "google", provider: "google", label: "Google", logoDataUrl: null },
    { key: "oidc--11111111-1111-4111-8111-111111111111", provider: "oidc", label: "Custom Auth", logoDataUrl: null }
  ])
}));

async function markup(element: ReactNode) {
  const stream = await renderToReadableStream(element);
  return (await new Response(stream).text()).replaceAll("<!-- -->", "");
}

describe("server-rendered login preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings.getSetting.mockResolvedValue(true);
    settings.getSettings.mockResolvedValue({
      siteName: "Preview site", localLoginEnabled: true,
      customLoginPage: { html: "<section><h1>{{LOGIN_TITLE}}</h1><p>{{LOGIN_TAGLINE}}</p>{{LOGIN_FORM}}</section>" }
    });
    turnstile.turnstileSiteKey.mockReturnValue("configured-site-key");
  });

  it.each(["yes", "no"])("has no authentication actions before hydration (custom=%s)", async (custom) => {
    const html = await markup(await LoginDevPage({ searchParams: Promise.resolve({ custom }) }));
    expect(html).toContain("data-surls-auth-form");
    expect(html).toContain("Sign in with passkey");
    expect(html).toContain("Continue with Google");
    expect(html).toContain("Continue with Custom Auth");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("/api/auth/");
    expect(html).not.toContain('type="submit"');
    expect(html).not.toContain('name="csrf"');
    expect(html).not.toContain('name="password"');
    expect(html).toContain('readOnly=""');
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain("challenges.cloudflare.com");
    expect(html).toContain('href="/login-dev?custom=no"');
    expect(html).toContain('href="/admin/settings"');
    expect(turnstile.turnstileSiteKey).not.toHaveBeenCalled();
  });

  it("keeps external-only previews free of authentication links", async () => {
    settings.getSettings.mockResolvedValue({ siteName: "Preview site", localLoginEnabled: false, customLoginPage: null });
    const html = await markup(await LoginDevPage({ searchParams: Promise.resolve({ custom: "no" }) }));
    expect(html).toContain("Continue with Google");
    expect(html).not.toContain("/api/auth/");
    expect(html).not.toContain("<input");
  });

  it("preserves real login submission and provider navigation outside preview", async () => {
    turnstile.turnstileSiteKey.mockReturnValue(undefined);
    const html = await markup(<PasswordLoginForm csrf="csrf-test" siteName="Surls" nextPath="/admin/links" localLoginEnabled />);
    expect(html).toContain('<form');
    expect(html).toContain('action="/api/auth/login"');
    expect(html).toContain('method="post"');
    expect(html).toContain('type="submit"');
    expect(html).toContain('name="csrf" value="csrf-test"');
    expect(html).toContain('href="/api/auth/external/google?next=%2Fadmin%2Flinks"');
    expect(html).not.toContain('aria-disabled="true"');
  });
});
