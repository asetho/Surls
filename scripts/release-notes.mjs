import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export function releaseNotes(changelog, version, previous) {
  const entry = changelog.split(/^## /m).find((section) => section.startsWith(`${version} - `));
  if (!entry) throw new Error(`Missing CHANGELOG.md entry for ${version}.`);
  const sections = new Map(entry.split(/^### /m).slice(1).map((section) => {
    const newline = section.indexOf("\n");
    return [section.slice(0, newline).trim(), section.slice(newline).trim()];
  }));
  const upgrades = sections.get("Upgrade Notes");
  if (!upgrades) throw new Error(`Missing upgrade notes for ${version}.`);
  const currentParts = version.split(".").map(Number);
  const previousParts = previous.split(".").map(Number);
  const type = currentParts[0] > previousParts[0] ? "MAJOR" : currentParts[1] > previousParts[1] ? "MINOR" : "PATCH";
  return [
    `🚀 Surls v${version}`,
    "## ✨ What’s New",
    [sections.get("Added"), sections.get("Changed")].filter(Boolean).join("\n\n") || "None.",
    "## 🛠 Fixes",
    [sections.get("Fixed"), sections.get("Security")].filter(Boolean).join("\n\n") || "None.",
    "## 📦 Upgrade Notes",
    upgrades,
    "## Version Info",
    `* Previous: ${previous}\n* Current: ${version}\n* Release Type: ${type}`
  ].join("\n\n") + "\n";
}

if (import.meta.main) {
  const version = process.argv[2];
  if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) throw new Error("Provide a release version.");
  const tags = execFileSync("git", ["tag", "--list", "--sort=-version:refname"], { encoding: "utf8" }).trim().split("\n");
  const previous = tags.find((tag) => /^v\d+\.\d+\.\d+$/.test(tag) && tag !== `v${version}`)?.slice(1) ?? "0.0.0";
  process.stdout.write(releaseNotes(readFileSync("CHANGELOG.md", "utf8"), version, previous));
}
