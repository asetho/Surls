import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("YOURLS importer privacy hashes", () => {
  it("previews without a key, but requires AUTH_SECRET before writing click logs", () => {
    const root = mkdtempSync(path.join(tmpdir(), "surls-yourls-privacy-test-"));
    try {
      const urlsPath = path.join(root, "urls.csv");
      const logsPath = path.join(root, "logs.csv");
      writeFileSync(urlsPath, "keyword,url,title,timestamp,clicks\nexample,https://example.com,,,1\n");
      writeFileSync(logsPath, "click_id,click_time,shorturl,referrer,user_agent,ip_address,country_code\n1,2024-01-01 00:00:00,example,,Test Agent,203.0.113.7,US\n");

      const run = (args: string[], authSecret: string) => spawnSync(process.execPath, ["scripts/import-yourls.mjs", "--urls", urlsPath, ...args], {
        encoding: "utf8",
        env: { ...process.env, AUTH_SECRET: authSecret, DATABASE_URL: "" }
      });

      const preview = run(["--logs", logsPath, "--dry-run"], "");
      expect(preview.status).toBe(0);
      expect(preview.stdout).toContain("Click events: 1");

      const missing = run(["--logs", logsPath, "--confirm"], "");
      expect(missing.status).toBe(1);
      expect(missing.stderr).toContain("AUTH_SECRET must be a high-entropy random value");
      expect(missing.stdout).not.toContain("YOURLS import preview");

      const weak = run(["--logs", logsPath, "--confirm"], "development-secret-change-before-production");
      expect(weak.status).toBe(1);
      expect(weak.stderr).toContain("AUTH_SECRET must be a high-entropy random value");

      const strong = run(["--logs", logsPath, "--confirm"], randomBytes(32).toString("base64"));
      expect(strong.status).toBe(1);
      expect(strong.stderr).toContain("DATABASE_URL is required");

      const urlOnly = run(["--confirm"], "");
      expect(urlOnly.status).toBe(1);
      expect(urlOnly.stderr).toContain("DATABASE_URL is required");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
