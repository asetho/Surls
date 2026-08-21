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

  it("adds nullable API source snapshot fields to short links", async () => {
    const migration = await readFile(
      resolve(process.cwd(), "prisma/migrations/20260630203500_add_short_link_api_source/migration.sql"),
      "utf8"
    );

    expect(migration).toContain('ALTER TABLE "ShortLink" ADD COLUMN "createdByApiTokenName" TEXT;');
    expect(migration).toContain('ALTER TABLE "ShortLink" ADD COLUMN "createdByApiTokenPrefix" TEXT;');
  });

  it("adds nullable user display timezone preferences", async () => {
    const migration = await readFile(
      resolve(process.cwd(), "prisma/migrations/20260630214500_add_user_display_time_zone/migration.sql"),
      "utf8"
    );

    expect(migration).toContain('ALTER TABLE "User" ADD COLUMN "displayTimeZone" TEXT;');
  });

  it("adds defaulted user mobile menu side preferences", async () => {
    const migration = await readFile(
      resolve(process.cwd(), "prisma/migrations/20260707142000_add_user_mobile_menu_side/migration.sql"),
      "utf8"
    );

    expect(migration).toContain('ALTER TABLE "User" ADD COLUMN "mobileMenuSide" TEXT NOT NULL DEFAULT \'right\';');
  });

  it("adds per-user upload limit overrides without changing existing users", async () => {
    const migration = await readFile(
      resolve(process.cwd(), "prisma/migrations/20260820231500_add_user_upload_limits/migration.sql"),
      "utf8"
    );

    expect(migration).toContain('ALTER TABLE "User" ADD COLUMN "uploadMaxBytes" BIGINT;');
    expect(migration).toContain(
      'ALTER TABLE "User" ADD COLUMN "uploadLimitUnlimited" BOOLEAN NOT NULL DEFAULT false;'
    );
  });
});
