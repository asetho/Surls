import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const output = fileURLToPath(new URL('../', import.meta.url));

// Illustrator-edited SVGs are the source of truth. Never rebuild their geometry
// from the historical trace, which predates the approved rounded wordmark.
(async () => {
  for (const [name, width] of [
    ['surls-s-links-mark', 2048],
    ['surls-s-links-lockup', 3000],
    ['surls-s-url-links', 3000]
  ]) {
    const svg = fs.readFileSync(path.join(output, name + '.svg'), 'utf8');
    await sharp(Buffer.from(svg)).resize({ width }).png().toFile(path.join(output, name + '.png'));
  }
  const full = fs.readFileSync(path.join(output, 'surls-s-links-lockup.svg'));
  const compact = fs.readFileSync(path.join(output, 'surls-s-url-links.svg'));
  const brandPanel = await sharp({ create: { width: 1500, height: 450, channels: 3, background: '#e6f2f8' } }).png().toBuffer();
  await sharp({ create: { width: 1500, height: 900, channels: 3, background: '#ffffff' } })
    .composite([
      { input: brandPanel, left: 0, top: 450 },
      { input: await sharp(full).resize({ width: 1300 }).png().toBuffer(), left: 100, top: 34 },
      { input: await sharp(compact).resize({ width: 1056 }).png().toBuffer(), left: 222, top: 484 }
    ]).png().toFile(path.join(output, 'preview.png'));
  console.log('Rendered transparent logo exports and preview from the approved vectors.');
})();
