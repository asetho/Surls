import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "static-dist");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, "src"), output, { recursive: true });
await cp(resolve(root, "public"), output, { recursive: true });
const assets = ["fonts/fonts.css", "style.css", "brand/brand.css", "theme.js"];
const revisions = await Promise.all(assets.map(async (asset) => {
  const content = await readFile(resolve(output, asset));
  return [asset, createHash("sha256").update(content).digest("hex").slice(0, 12)];
}));
for (const page of ["index.html", "404.html"]) {
  let html = await readFile(resolve(output, page), "utf8");
  for (const [asset, revision] of revisions) {
    html = html.replaceAll(`/${asset}"`, `/${asset}?v=${revision}"`);
  }
  await writeFile(resolve(output, page), html);
}
console.log(`Static site ready: ${output}`);
