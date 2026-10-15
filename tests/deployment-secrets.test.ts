import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const composeFiles = ["docker-compose.yml"];

describe("container deployment secrets", () => {
  it("keeps the Server Actions key out of Docker image arguments and environment metadata", async () => {
    const dockerfile = await readFile(resolve(process.cwd(), "Dockerfile"), "utf8");

    expect(dockerfile).toContain(
      "RUN --mount=type=secret,id=next_server_actions_encryption_key,required=false,env=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY npm run build"
    );
    expect(dockerfile).not.toMatch(/(?:ARG|ENV)\s+NEXT_SERVER_ACTIONS_ENCRYPTION_KEY/);
  });

  it.each(composeFiles)("uses a Compose secret for %s", async (composeFile) => {
    const compose = await readFile(resolve(process.cwd(), composeFile), "utf8");

    expect(compose).toContain("      secrets:\n        - next_server_actions_encryption_key");
    expect(compose).toContain("    secrets:\n      - next_server_actions_encryption_key");
    expect(compose).toContain("secrets:\n  next_server_actions_encryption_key:\n    environment: NEXT_SERVER_ACTIONS_ENCRYPTION_KEY");
    expect(compose).not.toContain('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: "${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:-}"');
  });

  it("loads the runtime secret from the Compose mount", async () => {
    const entrypoint = await readFile(resolve(process.cwd(), "scripts/docker-entrypoint.mjs"), "utf8");

    expect(entrypoint).toContain('const serverActionsKeyPath = "/run/secrets/next_server_actions_encryption_key";');
    expect(entrypoint).toContain("process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY = value;");
  });

  it("requires a runtime Server Actions key before starting a production container", () => {
    const runEntrypoint = (key: string) =>
      spawnSync(process.execPath, ["scripts/docker-entrypoint.mjs", process.execPath, "-e", "process.exit(0)"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_ENV: "production",
          DATABASE_URL: "postgresql://surls@localhost/surls",
          AUTH_SECRET: randomBytes(32).toString("hex"),
          NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: key,
          SURLS_RUN_MIGRATIONS: "false",
          SURLS_RUN_BOOTSTRAP: "false"
        }
      });

    const missing = runEntrypoint("");
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is required in production.");

    const configured = runEntrypoint(randomBytes(32).toString("base64"));
    expect(configured.status).toBe(0);
  });

  it("uses a disposable build key for published images", async () => {
    const workflow = await readFile(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");

    expect(workflow).toContain('printf \'%s\' "$(openssl rand -base64 32)" > "${RUNNER_TEMP}/surls-release-action-key"');
    expect(workflow).toContain("next_server_actions_encryption_key=${{ runner.temp }}/surls-release-action-key");
    expect(workflow).not.toContain("secrets.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY");
  });

  it.each(composeFiles)("bind-mounts uploaded files from an explicit host path in %s", async (composeFile) => {
    const compose = await readFile(resolve(process.cwd(), composeFile), "utf8");

    expect(compose).toContain(
      'source: "${SURLS_UPLOADS_PATH:?Set SURLS_UPLOADS_PATH to an existing host directory for uploaded files}"'
    );
    expect(compose).toContain("target: /app/uploads");
    expect(compose).toContain("create_host_path: false");
    expect(compose).not.toContain("surls-uploads:/app/uploads");
  });
});
