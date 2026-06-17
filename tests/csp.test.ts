import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "@/lib/csp";

describe("content security policy", () => {
  it("allows public custom page assets used by the deployed pages", () => {
    const csp = buildContentSecurityPolicy({ nonce: "test-nonce" });

    expect(csp).toContain("img-src 'self' data: https://cdn.asetho.com https://static.addtoany.com https://www.addtoany.com");
    expect(csp).toContain("script-src 'self' 'nonce-test-nonce'");
    expect(csp).toContain("https://static.addtoany.com");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain(
      "connect-src 'self' https://cdn.asetho.com https://p.typekit.net https://cloudflareinsights.com https://static.addtoany.com https://www.addtoany.com https://stats.addtoany.com"
    );
    expect(csp).toContain("frame-src 'self' about: https://static.addtoany.com https://www.addtoany.com");
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
});
