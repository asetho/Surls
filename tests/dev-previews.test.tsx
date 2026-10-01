import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProfileFlowPreview } from "@/app/admin/dev/profile/ProfileFlowPreview";
import { hmservDevPreviewEnabled } from "@/lib/dev-preview";

const previewEnv = vi.hoisted(() => ({ BASE_URL: "https://link.hm.aarn.cc", SURLS_LOGIN_DEV_ENABLED: true }));
vi.mock("@/lib/env", () => ({ env: previewEnv }));

describe("hmserv-only development previews", () => {
  it("requires both the dev flag and the hmserv development hostname", () => {
    expect(hmservDevPreviewEnabled()).toBe(true);
    previewEnv.BASE_URL = "https://asetho.link";
    expect(hmservDevPreviewEnabled()).toBe(false);
    previewEnv.BASE_URL = "https://link.hm.aarn.cc";
    previewEnv.SURLS_LOGIN_DEV_ENABLED = false;
    expect(hmservDevPreviewEnabled()).toBe(false);
    previewEnv.SURLS_LOGIN_DEV_ENABLED = true;
  });

  it("renders a profile policy simulation without live actions", async () => {
    const stream = await renderToReadableStream(
      <ProfileFlowPreview
        currentEmail="sample@example.com"
        initial={{ emailCodeAvailable: true, hasPasskey: true, linkedProvider: true, passwordAvailable: true, totpEnabled: true }}
        name="Sample Admin"
        providerName="asetho Auth"
      />
    );
    const html = await new Response(stream).text();
    expect(html).toContain("Profile verification preview");
    expect(html).toContain("Current email reachable");
    expect(html).toContain("Regenerate backup codes");
    expect(html).toContain("Add passkey");
    expect(html).toContain("Changing the email opens verification after Save profile");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("/api/auth/");
    expect(html).not.toContain('type="submit"');
  });
});
