import { describe, expect, it } from "vitest";
import { isNewReleaseVersion } from "../scripts/check-release-version.mjs";
import { releaseNotes } from "../scripts/release-notes.mjs";

describe("explicit release versions", () => {
  it("accepts an intentional minor bump and ignores other app tags", () => {
    expect(isNewReleaseVersion("1.15.0", ["v1.14.39", "surls-share-v9.0.0"])).toBe(true);
    expect(isNewReleaseVersion("1.14.40", ["v1.14.39"])).toBe(true);
  });
  it.each(["1.14.39", "1.14.38", "1.13.99", "1.15.0-beta", "invalid"])("rejects unchanged, older, or malformed version %s", (version) => {
    expect(isNewReleaseVersion(version, ["v1.14.39"])).toBe(false);
  });
  it("formats the release using the versioning policy and requires curated upgrade notes", () => {
    const changelog = "## 1.15.0 - 2026-09-24\n### Added\n* Preview login pages.\n### Fixed\n* Match custom-theme colors.\n### Upgrade Notes\nRun the included database migrations.\n\n## 1.14.39 - 2026-09-23\n### Fixed\n* Previous fix.\n";
    const notes = releaseNotes(changelog, "1.15.0", "1.14.39");
    expect(notes).toContain("🚀 Surls v1.15.0");
    for (const heading of ["✨ What’s New", "🛠 Fixes", "📦 Upgrade Notes", "Version Info"]) expect(notes).toContain(heading);
    expect(notes).toContain("* Previous: 1.14.39\n* Current: 1.15.0\n* Release Type: MINOR");
    expect(notes).toContain("Run the included database migrations");
    expect(() => releaseNotes(changelog, "9.0.0", "1.15.0")).toThrow("Missing CHANGELOG.md entry");
    expect(() => releaseNotes("## 1.15.0 - 2026-09-24\n### Added\n* Example", "1.15.0", "1.14.39")).toThrow("Missing upgrade notes");
  });
});
