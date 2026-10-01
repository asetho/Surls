import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = resolve(root, "assets/branding");
const app = resolve(root, "public/brand");
const site = resolve(root, "apps/site/public/brand");
const docs = resolve(root, "apps/docs/docs/assets/images");
const mark = await readFile(resolve(source, "surls-s-links-mark.svg"), "utf8");
const logo = await readFile(resolve(source, "surls-s-links-lockup.svg"), "utf8");
const compactLogo = await readFile(resolve(source, "surls-s-url-links.svg"), "utf8");
// Keep both web variants on the same approved paths and original lower-link teal.
const darkLogo = compactLogo.replaceAll("#015a85", "#c6e6f5");
await writeFile(resolve(source, "surls-s-url-links-dark.svg"), darkLogo);
await sharp(Buffer.from(darkLogo)).resize({ width: 3000 }).png()
  .toFile(resolve(source, "surls-s-url-links-dark.png"));

for (const directory of [app, site, docs]) await mkdir(directory, { recursive: true });
for (const directory of [app, site]) {
  await writeFile(resolve(directory, "surls-app-icon.svg"), mark);
  await writeFile(resolve(directory, "surls-logo-horizontal.svg"), logo);
  await writeFile(resolve(directory, "surls-s-url-links.svg"), compactLogo);
  await writeFile(resolve(directory, "surls-s-url-links-dark.svg"), darkLogo);
  for (const size of [80, 180, 192, 512, 1024]) {
    await sharp(Buffer.from(mark)).resize(size, size)
      .png().toFile(resolve(directory, `surls-app-icon-${size}.png`));
  }
}
// ICO supports a PNG payload; keep the favicon derived from the same mark.
const favicon = await sharp(Buffer.from(mark)).resize(32, 32).png().toBuffer();
const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(1, 4);
icoHeader[6] = 32;
icoHeader[7] = 32;
icoHeader.writeUInt16LE(1, 10);
icoHeader.writeUInt16LE(32, 12);
icoHeader.writeUInt32LE(favicon.length, 14);
icoHeader.writeUInt32LE(22, 18);
for (const directory of [app, site]) await writeFile(resolve(directory, "favicon.ico"), Buffer.concat([icoHeader, favicon]));
await sharp(Buffer.from(logo)).resize({ width: 1473 }).png().toFile(resolve(app, "surls-logo-horizontal.png"));
await sharp(Buffer.from(mark)).resize(512, 512).png().toFile(resolve(app, "surls-icon-urls-logo.png"));
await writeFile(resolve(docs, "icon.svg"), mark);
await writeFile(resolve(docs, "logo.svg"), compactLogo);
await writeFile(resolve(docs, "logo-dark.svg"), darkLogo);
await cp(resolve(app, "brand.css"), resolve(site, "brand.css"));

for (const destination of ["apps/site/public/fonts", "apps/docs/docs/assets/fonts"]) {
  await cp(resolve(root, "public/fonts"), resolve(root, destination), {
    recursive: true,
    filter: (path) => !path.endsWith("/README.md")
  });
}
console.log("Synced supplied Surls logos and local fonts to the app, site, and docs.");
