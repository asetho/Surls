import { execFileSync } from "node:child_process";

export function isNewReleaseVersion(version, tags) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) return false;
  const parts = version.split(".").map(Number);
  return tags.filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag)).every((tag) => {
    const previous = tag.slice(1).split(".").map(Number);
    for (let index = 0; index < 3; index += 1) {
      if (parts[index] !== previous[index]) return parts[index] > previous[index];
    }
    return false;
  });
}

if (import.meta.main) {
  const tags = execFileSync("git", ["tag", "--list"], { encoding: "utf8" }).trim().split("\n");
  if (!isNewReleaseVersion(process.argv[2], tags)) {
    console.error("The selected release version must be greater than every existing Surls release tag.");
    process.exitCode = 1;
  }
}
