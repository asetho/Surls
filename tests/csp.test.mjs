import { describe, expect, it } from "vitest";
import nextConfig from "../next.config.mjs";

async function cspHeader() {
  const rules = await nextConfig.headers();
  const csp = rules.flatMap((rule) => rule.headers).find((header) => header.key === "Content-Security-Policy");
  return csp?.value ?? "";
}

describe("content security policy", () => {
  it("allows public custom page assets used by the deployed pages", async () => {
    const csp = await cspHeader();

    expect(csp).toContain("img-src 'self' data: https://cdn.asetho.com");
    expect(csp).not.toContain("'unsafe-inline' https://static.addtoany.com");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("https://www.addtoany.com");
    expect(csp).toContain("https://use.typekit.net");
    expect(csp).toContain("https://p.typekit.net");
    expect(csp).toContain("font-src 'self' https://cdn.asetho.com https://use.typekit.net");
    expect(csp).not.toContain("https://www.slant.co");
    expect(csp).toContain("https://static.cloudflareinsights.com");
    expect(csp).toContain("https://cloudflareinsights.com");
  });
});
