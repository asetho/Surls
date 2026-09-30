import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "static-dist");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, "src"), output, { recursive: true });
await cp(resolve(root, "public"), output, { recursive: true });
console.log(`Static site ready: ${output}`);
