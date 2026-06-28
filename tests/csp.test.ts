import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, getCspExtraSources } from "@/lib/csp";

describe("content security policy", () => {
  it("allows public custom page assets used by the deployed pages", () => {
    const csp = buildContentSecurityPolicy({ nonce: "test-nonce" });

    expect(csp).toContain("img-src 'self' data: https://cdn.asetho.com https://static.addtoany.com https://www.addtoany.com");
    expect(csp).toContain("script-src 'self' 'nonce-test-nonce'");
    expect(csp).toContain("https://static.addtoany.com");
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain(
      "connect-src 'self' https://cdn.asetho.com https://p.typekit.net https://challenges.cloudflare.com https://cloudflareinsights.com https://static.addtoany.com https://www.addtoany.com https://stats.addtoany.com"
    );
    expect(csp).toContain("frame-src 'self' about: https://challenges.cloudflare.com https://static.addtoany.com https://www.addtoany.com");
    expect(csp).toContain("https://use.typekit.net");
    expect(csp).toContain("https://p.typekit.net");
    expect(csp).toContain("font-src 'self' https://cdn.asetho.com https://use.typekit.net");
    expect(csp).not.toContain("https://www.slant.co");
    expect(csp).toContain("https://static.cloudflareinsights.com");
    expect(csp).toContain("https://cloudflareinsights.com");
  });

  it("adds unsafe eval only in development", () => {
    expect(buildContentSecurityPolicy({ isDev: true, nonce: "dev-nonce" })).toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy({ isDev: false, nonce: "prod-nonce" })).not.toContain("'unsafe-eval'");
  });

  it("can omit insecure request upgrades for direct HTTP origins", () => {
    expect(buildContentSecurityPolicy({ nonce: "test-nonce" })).toContain("upgrade-insecure-requests");
    expect(buildContentSecurityPolicy({ nonce: "test-nonce", upgradeInsecureRequests: false })).not.toContain("upgrade-insecure-requests");
  });

  it("allows installs to add directive-specific host sources", () => {
    const csp = buildContentSecurityPolicy({
      nonce: "test-nonce",
      extraSources: {
        script: ["https://scripts.example.test"],
        connect: ["https://api.example.test"],
        img: ["https://images.example.test"]
      }
    });

    expect(csp).toContain("script-src 'self' 'nonce-test-nonce'");
    expect(csp).toContain("https://scripts.example.test");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("https://api.example.test");
    expect(csp).toContain("img-src 'self' data:");
    expect(csp).toContain("https://images.example.test");
  });

  it("reads extra host sources from comma or space separated env values", () => {
    const extraSources = getCspExtraSources({
      SURLS_CSP_SCRIPT_SRC_EXTRA: "https://scripts.example.test, https://widgets.example.test",
      SURLS_CSP_FRAME_SRC_EXTRA: "https://frames.example.test"
    });

    expect(extraSources.script).toEqual(["https://scripts.example.test", "https://widgets.example.test"]);
    expect(extraSources.frame).toEqual(["https://frames.example.test"]);
  });

  it("rejects unsafe script extras and directive injection", () => {
    expect(() => getCspExtraSources({ SURLS_CSP_SCRIPT_SRC_EXTRA: "'unsafe-inline'" })).toThrow(/Invalid CSP script source/);
    expect(() => getCspExtraSources({ SURLS_CSP_IMG_SRC_EXTRA: "https://ok.test; script-src *" })).toThrow(/Invalid CSP source/);
  });
});
