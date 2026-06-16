import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const nextTypesDir = path.join(process.cwd(), ".next", "types");
const conflictCopyPattern = /\s+\d+\.tsx?$/;

async function removeConflictCopies(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }

  let removed = 0;
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removed += await removeConflictCopies(entryPath);
      continue;
    }
    if (entry.isFile() && conflictCopyPattern.test(entry.name)) {
      await rm(entryPath);
      removed += 1;
    }
  }
  return removed;
}

const removed = await removeConflictCopies(nextTypesDir);
if (removed > 0) {
  console.log(`Removed ${removed} generated Next type conflict file${removed === 1 ? "" : "s"}.`);
}
