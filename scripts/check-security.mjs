import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];
const skippedDirectories = new Set(['.git', '.claude', 'coverage', 'dist', 'node_modules', 'playwright-report', 'test-results']);
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.ts', '.tsx', '.txt', '.xml', '.yml', '.yaml']);

async function collectTextFiles(relativeDirectory = '.') {
  const files = [];
  for (const entry of await readdir(path.join(root, relativeDirectory), { withFileTypes: true })) {
    if (entry.name === 'check-security.mjs' || entry.name.endsWith('.log')) continue;
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) files.push(...await collectTextFiles(relativePath));
    } else if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(relativePath);
    }
  }
  return files;
}

const files = await collectTextFiles();
const secretPatterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['OpenAI-style secret', /\bsk-[A-Za-z0-9_-]{20,}\b/],
];

for (const relativePath of files) {
  const content = await readFile(path.join(root, relativePath), 'utf8');
  for (const [label, pattern] of secretPatterns) {
    if (pattern.test(content)) failures.push(`${relativePath}: possible ${label}`);
  }
}

const productionFiles = files.filter((relativePath) =>
  relativePath === 'index.html'
  || relativePath === 'vite.config.ts'
  || relativePath.startsWith(`src${path.sep}`)
  || relativePath.startsWith(`public${path.sep}`));
const dangerousPatterns = [
  ['eval', /\beval\s*\(/],
  ['Function constructor', /\bnew\s+Function\s*\(/],
  ['document.write', /\bdocument\.write\s*\(/],
  ['React raw HTML', /\bdangerouslySetInnerHTML\b/],
];

for (const relativePath of productionFiles) {
  const content = await readFile(path.join(root, relativePath), 'utf8');
  for (const [label, pattern] of dangerousPatterns) {
    if (pattern.test(content)) failures.push(`${relativePath}: forbidden dynamic execution API (${label})`);
  }
}

const headers = await readFile(path.join(root, 'public', '_headers'), 'utf8');
const csp = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1] ?? '';
if (!csp) failures.push('public/_headers: Content-Security-Policy is missing');
if (/\bunsafe-eval\b/.test(csp)) failures.push("public/_headers: CSP permits 'unsafe-eval'");
if (/script-src[^;]*unsafe-inline/.test(csp)) failures.push("public/_headers: script-src permits 'unsafe-inline'");
if (/(?:^|;)\s*(?:default|script|connect|frame)-src[^;]*\*/.test(csp)) failures.push('public/_headers: CSP contains a wildcard source');

async function collectDistFiles(relativeDirectory = 'dist') {
  const files = [];
  for (const entry of await readdir(path.join(root, relativeDirectory), { withFileTypes: true })) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...await collectDistFiles(relativePath));
    if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

const distFiles = await collectDistFiles();
for (const relativePath of distFiles) {
  const normalized = relativePath.replaceAll('\\', '/');
  if (normalized.endsWith('.map')) failures.push(`${relativePath}: source map is deployed`);
  if (/(?:^|\/)\.env(?:\.|$)|(?:^|\/)\.git(?:\/|$)|(?:^|\/)package(?:-lock)?\.json$|\.(?:ts|tsx)$/.test(normalized)) {
    failures.push(`${relativePath}: development or source file is deployed`);
  }
}

if (failures.length > 0) {
  console.error('Security consistency check failed:');
  for (const failure of failures.sort()) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Security consistency check passed (${files.length} text files, ${distFiles.length} deployment files).`);
}
