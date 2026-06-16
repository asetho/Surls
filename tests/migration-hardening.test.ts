import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("API token hardening migration", () => {
  it("adds default link-create scope and nullable expiration for existing API tokens", async () => {
    const migration = await readFile(
      resolve(process.cwd(), "prisma/migrations/20260615223000_harden_api_tokens_retention/migration.sql"),
      "utf8"
    );

    expect(migration).toContain('ALTER TABLE "ApiToken" ADD COLUMN "scopes" TEXT NOT NULL DEFAULT \'links:create\';');
    expect(migration).toContain('ALTER TABLE "ApiToken" ADD COLUMN "expiresAt" TIMESTAMP(3);');
    expect(migration).toContain('CREATE INDEX "ApiToken_expiresAt_idx" ON "ApiToken"("expiresAt");');
  });
});
