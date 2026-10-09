import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

async function collectHtml(relativeDirectory) {
  const entries = await readdir(path.join(root, relativeDirectory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...await collectHtml(relativePath));
    if (entry.isFile() && entry.name.endsWith('.html')) files.push(relativePath);
  }
  return files;
}

const [sourceHeaders, builtHeaders, wrangler] = await Promise.all([
  read(path.join('public', '_headers')),
  read(path.join('dist', '_headers')),
  read('wrangler.jsonc'),
]);

if (sourceHeaders.replace(/\r\n/g, '\n') !== builtHeaders.replace(/\r\n/g, '\n')) {
  failures.push('dist/_headers differs from public/_headers');
}

for (const directive of [
  "script-src 'self'",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
]) {
  if (!sourceHeaders.includes(directive)) failures.push(`CSP is missing: ${directive}`);
}
if (!wrangler.includes('"not_found_handling": "single-page-application"')) failures.push('Wrangler SPA fallback is missing');
if (!wrangler.includes('resume.nuconeko-garden.com')) failures.push('Wrangler custom domain is missing');
const builtIndex = await read(path.join('dist', 'index.html'));
const sitemap = await read(path.join('dist', 'sitemap.xml'));
if (!builtIndex.includes('<title>Rirekisho Studio｜無料の履歴書作成アプリ</title>')) failures.push('branded page title is missing');
if (!builtIndex.includes('<link rel="canonical" href="https://resume.nuconeko-garden.com/"')) failures.push('homepage canonical is missing');
if (!builtIndex.includes('<h1>Rirekisho Studio｜無料の履歴書作成アプリ</h1>')) failures.push('crawlable homepage heading is missing');
if (!builtIndex.includes('href="/app"')) failures.push('crawlable editor link is missing');
if (!sitemap.includes('<loc>https://resume.nuconeko-garden.com/</loc>')) failures.push('canonical sitemap is missing');
if (sitemap.includes('<loc>https://resume.nuconeko-garden.com/app</loc>')) failures.push('editor route should not compete with the homepage in sitemap');

for (const htmlPath of await collectHtml('dist')) {
  const html = await read(htmlPath);
  if (/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i.test(html)) {
    failures.push(`${htmlPath} contains an inline script blocked by the deployment CSP`);
  }
  if (/\son[a-z]+\s*=/i.test(html)) {
    failures.push(`${htmlPath} contains an inline event handler blocked by the deployment CSP`);
  }
}

const manualFiles = [
  'INDEX.md',
  '01-introduction.md',
  '02-overview.md',
  '03-input-guide.md',
  '04-accommodation.md',
  '05-pdf-output.md',
  '06-save-load.md',
  '07-faq.md',
  '08-appendix.md',
  'index.html',
  'manual.js',
  'style.css',
];
const serviceWorker = await read(path.join('dist', 'sw.js'));
for (const name of manualFiles) {
  try {
    await read(path.join('dist', 'manual', name));
  } catch {
    failures.push(`dist/manual/${name} is missing`);
  }
  if (!serviceWorker.includes(`manual/${name}`)) {
    failures.push(`service worker does not precache manual/${name}`);
  }
}

const manualIndex = await read(path.join('dist', 'manual', 'INDEX.md'));
const todayInJapan = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}).format(new Date());
if (!manualIndex.includes(`最新版の作成日：${todayInJapan}`)) {
  failures.push('manual release date was not stamped with the current Japan date');
}

if (failures.length > 0) {
  console.error('Deployment consistency check failed:');
  for (const failure of failures.sort()) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Deployment consistency check passed.');
}
