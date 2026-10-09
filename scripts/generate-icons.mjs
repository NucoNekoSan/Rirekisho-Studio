import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

// Derive all distributed icons from the hand-drawn SVG master.
const asset = (name) => new URL(`../public/${name}`, import.meta.url);
const svg = await readFile(asset('favicon.svg'), 'utf8');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const render = async (size, source = svg) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${source}`);
    return page.screenshot({ type: 'png', omitBackground: true });
  };
  for (const size of [64, 192, 512]) {
    await writeFile(asset(`pwa-${size}x${size}.png`), await render(size));
  }
  // Apple supplies its own corner mask; use a full-bleed opaque background.
  const fullBleed = svg.replace('rx="14"', 'rx="0"');
  await writeFile(asset('apple-touch-icon-180x180.png'), await render(180, fullBleed));
  // Foreground fits inside the central 80%-diameter safe circle.
  const maskable = fullBleed.replace('id="resume"', 'id="resume" transform="translate(6.4 6.4) scale(0.8)"');
  await writeFile(asset('maskable-icon-512x512.png'), await render(512, maskable));

  const sizes = [16, 32, 48];
  const images = [];
  for (const size of sizes) images.push(await render(size));
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16;
    header[entry] = size;
    header[entry + 1] = size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(images[index].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += images[index].length;
  });
  await writeFile(asset('favicon.ico'), Buffer.concat([header, ...images]));
  console.log('Generated ICO, PWA, Apple touch, and maskable icons from favicon.svg.');
} finally {
  await browser.close();
}
