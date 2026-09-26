import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("release signing cleanup", () => {
  it.each([false, true])("removes all decoded material when keychain cleanup fails: %s", (failKeychain) => {
    const root = mkdtempSync(path.join(tmpdir(), "surls-signing-test-"));
    try {
      const names = ["surls-share-signing.keychain-db", "surls-share-developer-id.p12", "surls-share-app.provisionprofile", "surls-share-extension.provisionprofile", "surls-share-app-profile.plist", "surls-share-extension-profile.plist", "installed-app.provisionprofile", "installed-extension.provisionprofile", "AuthKey_TEST.p8"];
      for (const name of names) writeFileSync(path.join(root, name), "harmless fixture");
      writeFileSync(path.join(root, "unrelated"), "keep");
      writeFileSync(path.join(root, "security"), `#!/bin/sh\nexit ${failKeychain ? 1 : 0}\n`, { mode: 0o700 });
      const result = spawnSync("bash", ["scripts/cleanup-share-signing.sh"], {
        env: { ...process.env, PATH: `${root}:${process.env.PATH}`, RUNNER_TEMP: root, SURLS_SHARE_APP_PROFILE_PATH: path.join(root, names[6]), SURLS_SHARE_EXTENSION_PROFILE_PATH: path.join(root, names[7]), SURLS_SHARE_NOTARY_KEY_PATH: path.join(root, names[8]) }
      });
      expect(result.status).toBe(failKeychain ? 1 : 0);
      for (const name of names) expect(existsSync(path.join(root, name))).toBe(false);
      expect(existsSync(path.join(root, "unrelated"))).toBe(true);
      execFileSync("bash", ["scripts/cleanup-share-signing.sh"], { env: {
        ...process.env,
        RUNNER_TEMP: root,
        SURLS_SHARE_APP_PROFILE_PATH: "",
        SURLS_SHARE_EXTENSION_PROFILE_PATH: "",
        SURLS_SHARE_NOTARY_KEY_PATH: ""
      } });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("cleans partial installs before artifact upload and records dynamic paths before writing", () => {
    const workflow = readFileSync(".github/workflows/surls-share.yml", "utf8");
    expect(workflow).toContain('if: always()\n        run: bash scripts/cleanup-share-signing.sh');
    expect(workflow.indexOf("name: Remove signing materials")).toBeLessThan(workflow.indexOf("name: Upload workflow artifact"));
    expect(workflow.indexOf('echo "SURLS_SHARE_APP_PROFILE_PATH=')).toBeLessThan(workflow.indexOf('cp "${app_profile_source}"'));
    expect(workflow.indexOf('echo "SURLS_SHARE_EXTENSION_PROFILE_PATH=')).toBeLessThan(workflow.indexOf('cp "${extension_profile_source}"'));
    expect(workflow.indexOf('echo "SURLS_SHARE_NOTARY_KEY_PATH=')).toBeLessThan(workflow.indexOf('printf \'%s\' "${NOTARY_KEY_BASE64}"'));
  });
});
