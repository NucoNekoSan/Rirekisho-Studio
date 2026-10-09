import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const manualIndexPath = path.join(process.cwd(), 'dist', 'manual', 'INDEX.md');
const today = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}).format(new Date());

const source = await readFile(manualIndexPath, 'utf8');
if (!/^最新版の作成日：.*$/m.test(source)) {
  throw new Error('マニュアル目次に「最新版の作成日」行が見つかりません。');
}
const stamped = source.replace(/^最新版の作成日：.*$/m, `最新版の作成日：${today}`);

await writeFile(manualIndexPath, stamped, 'utf8');
console.log(`Manual release date stamped: ${today}`);
