import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TurnstileGate } from "@/components/TurnstileGate";

describe("TurnstileGate", () => {
  it("renders protected content immediately when Turnstile is not configured", () => {
    const html = renderToStaticMarkup(
      <TurnstileGate>
        <input data-surls-auth-input name="email" />
      </TurnstileGate>
    );

    expect(html).toContain("data-surls-auth-input");
    expect(html).not.toContain("Security check");
  });

  it("withholds protected content until the security check passes", () => {
    const html = renderToStaticMarkup(
      <TurnstileGate siteKey="site-key">
        <input data-surls-auth-input name="email" />
        <button data-surls-auth-submit>Log in</button>
      </TurnstileGate>
    );

    expect(html).toContain("Security check");
    expect(html).toContain("data-surls-auth-turnstile");
    expect(html).toContain('data-turnstile-status="idle"');
    expect(html).toContain("Complete this check to load the sign-in form.");
    expect(html).not.toContain("data-surls-auth-input");
    expect(html).not.toContain("data-surls-auth-submit");
    expect(html).not.toContain("cf-turnstile-response");
  });

  it("forces a verified gate to stay hidden even when component styles set display", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

    expect(css).toContain('.turnstile-gate[data-turnstile-status="verified"]');
    expect(css).toMatch(/\.turnstile-gate\[hidden\],[\s\S]*display:\s*none\s*!important;/);
  });
});
