import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const sourceRoot = join(process.cwd(), 'src');
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx') || entry === 'test') return [];
    return statSync(fullPath).isDirectory() ? sourceFiles(fullPath) : [fullPath];
  });

describe('browser storage boundary', () => {
  it('uses IndexedDB for resume documents and localStorage only for non-PII consent', () => {
    const combined = sourceFiles(sourceRoot).map((file) => readFileSync(file, 'utf8')).join('\n');

    expect(combined).not.toMatch(/\bsessionStorage\s*[.[]/);
    expect(combined).toContain("localStorage.getItem('rirekisho-studio:storage-consent')");
    expect(combined).not.toMatch(/localStorage\.(?:setItem|getItem)\([^)]*(?:name|address|phone|photo|accommodation)/i);
    expect(combined).toContain("const DATABASE_NAME = 'rirekisho-studio'");
    expect(combined).toContain('indexedDB.open(DATABASE_NAME');
  });
});
