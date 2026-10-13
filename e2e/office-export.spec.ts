import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { expect, test } from '@playwright/test';

test('imports edited Word and Excel files through the input-data picker', async ({ page }) => {
  await page.goto('/app');
  await page.getByRole('textbox', { name: '氏名', exact: true }).fill('出力前の氏名');
  for (const extension of ['docx', 'xlsx'] as const) {
    await page.getByRole('button', { name: /保存形式を変更/ }).click();
    await page.getByRole('radio', { name: extension === 'docx' ? 'Word（.docx）' : 'Excel（.xlsx）' }).check();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: extension === 'docx' ? '履歴書Wordを保存' : '履歴書Excelを保存' }).click();
    const downloaded = await downloadPromise;
    const buffer = await readFile((await downloaded.path())!);
    let edited: Buffer;
    if (extension === 'docx') {
      const zip = await JSZip.loadAsync(buffer);
      const xml = await zip.file('word/document.xml')!.async('string');
      zip.file('word/document.xml', xml.replace('出力前の氏名', 'Wordで編集した氏名'));
      edited = await zip.generateAsync({ type: 'nodebuffer' });
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      workbook.getWorksheet('履歴書 1')!.getCell('C4').value = 'Excelで編集した氏名';
      edited = Buffer.from(await workbook.xlsx.writeBuffer());
    }
    await page.getByLabel('入力データを読込').setInputFiles({
      name: `edited.${extension}`, mimeType: extension === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: edited,
    });
    await expect(page.getByRole('textbox', { name: '氏名', exact: true })).toHaveValue(`${extension === 'docx' ? 'Word' : 'Excel'}で編集した氏名`);
  }
});

test('imports a changed JPEG photo from an app-created Word file', async ({ page }) => {
  await page.goto('/app');
  const makePhoto = async (color: string) => page.evaluate((fill) => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 400;
    const context = canvas.getContext('2d')!;
    context.fillStyle = fill;
    context.fillRect(0, 0, 300, 400);
    return canvas.toDataURL('image/jpeg').split(',')[1];
  }, color);
  const first = Buffer.from(await makePhoto('#144466'), 'base64');
  const replacement = Buffer.from(await makePhoto('#bb4433'), 'base64');
  await page.getByLabel('写真を選択').setInputFiles({ name: 'first.jpg', mimeType: 'image/jpeg', buffer: first });
  const before = await page.getByAltText('取り込み済みの履歴書用写真').getAttribute('src');
  await page.getByRole('button', { name: /保存形式を変更/ }).click();
  await page.getByRole('radio', { name: 'Word（.docx）' }).check();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '履歴書Wordを保存' }).click();
  const downloaded = await downloadPromise;
  const zip = await JSZip.loadAsync(await readFile((await downloaded.path())!));
  const media = Object.values(zip.files).find((entry) => entry.name.startsWith('word/media/') && !entry.dir)!;
  const originalMedia = await media.async('nodebuffer');
  zip.file(media.name, replacement);
  await page.getByLabel('入力データを読込').setInputFiles({ name: 'changed-photo.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: await zip.generateAsync({ type: 'nodebuffer' }) });
  await expect(page.getByText('入力データを読み込みました。')).toBeVisible();
  await expect(page.getByAltText('取り込み済みの履歴書用写真')).toBeVisible();
  await expect.poll(async () => (await page.getByAltText('取り込み済みの履歴書用写真').getAttribute('src')) !== before).toBe(true);
  const savedAgain = page.waitForEvent('download');
  await page.getByRole('button', { name: '履歴書Wordを保存' }).click();
  const reexported = await JSZip.loadAsync(await readFile((await (await savedAgain).path())!));
  const reexportedMedia = Object.values(reexported.files).find((entry) => entry.name.startsWith('word/media/') && !entry.dir)!;
  expect((await reexportedMedia.async('nodebuffer')).equals(originalMedia)).toBe(false);
});

test('downloads the default A4 template in both editable formats', async ({ page }, testInfo) => {
  await page.goto('/app');
  for (const [label, extension] of [
    ['履歴書Wordを保存', 'docx'],
    ['履歴書Excelを保存', 'xlsx'],
  ] as const) {
    await page.getByRole('button', { name: /保存形式を変更/ }).click();
    await page.getByRole('radio', { name: extension === 'docx' ? 'Word（.docx）' : 'Excel（.xlsx）' }).check();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: label }).click();
    const download = await downloadPromise;
    expect(await download.failure()).toBeNull();
    await download.saveAs(testInfo.outputPath(`blank-a4.${extension}`));
  }
});

test('downloads editable Word and Excel files with the selected supplement', async ({ page }, testInfo) => {
  await page.goto('/app');
  await page.getByRole('button', { name: 'A3横・配慮事項付きデモを入力' }).click();

  await page.getByRole('checkbox', { name: '配慮事項も含める' }).check();
  for (const [label, extension] of [
    ['履歴書と配慮事項Wordを保存', 'docx'],
    ['履歴書と配慮事項Excelを保存', 'xlsx'],
  ] as const) {
    await page.getByRole('button', { name: /保存形式を変更/ }).click();
    await page.getByRole('radio', { name: extension === 'docx' ? 'Word（.docx）' : 'Excel（.xlsx）' }).check();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: label }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`rirekisho-a3-and-accommodation.${extension}`);
    expect(await download.failure()).toBeNull();
    await download.saveAs(testInfo.outputPath(`a3-and-accommodation.${extension}`));
  }
});

test('downloads the A4 resume as Word and Excel', async ({ page }, testInfo) => {
  await page.goto('/app');
  await page.getByRole('button', { name: 'A4縦・配慮事項付きデモを入力' }).click();
  for (const [label, extension] of [
    ['履歴書Wordを保存', 'docx'],
    ['履歴書Excelを保存', 'xlsx'],
  ] as const) {
    await page.getByRole('button', { name: /保存形式を変更/ }).click();
    await page.getByRole('radio', { name: extension === 'docx' ? 'Word（.docx）' : 'Excel（.xlsx）' }).check();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: label }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`rirekisho.${extension}`);
    expect(await download.failure()).toBeNull();
    await download.saveAs(testInfo.outputPath(`a4.${extension}`));
  }
});

for (const paperFormat of ['a4-portrait', 'a3-landscape'] as const) {
  test(`${paperFormat} exports preserve photos and continuation rows without private content`, async ({ page }, testInfo) => {
    await page.goto('/app');
    const photo = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 400;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#2f5d50';
      context.fillRect(0, 0, 300, 400);
      return canvas.toDataURL('image/jpeg').split(',')[1];
    });
    await page.getByLabel('写真を選択').setInputFiles({
      name: 'test-photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(photo, 'base64'),
    });
    await expect(page.getByAltText('取り込み済みの履歴書用写真')).toBeVisible();
    await page.getByRole('checkbox', { name: '写真も入力データに含める' }).check();
    const projectDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '入力データを保存' }).click();
    const projectDownload = await projectDownloadPromise;
    const project = JSON.parse(await readFile((await projectDownload.path())!, 'utf8'));
    project.state.resume.basic.name = '引き継ぎテスト';
    project.state.resume.pdfPaperFormat = paperFormat;
    project.state.resume.memo = '非公開作業メモ';
    project.state.resume.enabledSupplements = ['accommodation'];
    project.state.accommodation.strengths = '今回は含めない配慮事項';
    project.state.resume.histories = Array.from({ length: 31 }, (_, index) => ({
      id: `handoff-${index}`, year: `${1990 + index}`, month: '4', text: `確認用履歴${index + 1}番`,
    }));
    await page.getByLabel('入力データを読込').setInputFiles({
      name: 'handoff.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)),
    });
    await expect(page.getByRole('textbox', { name: '氏名', exact: true })).toHaveValue('引き継ぎテスト');
    await expect(page.getByRole('checkbox', { name: '配慮事項も含める', exact: true })).not.toBeChecked();
    for (const extension of ['docx', 'xlsx'] as const) {
      const format = extension === 'docx' ? 'Word' : 'Excel';
      await page.getByRole('button', { name: /保存形式を変更/ }).click();
      await page.getByRole('radio', { name: `${format}（.${extension}）` }).check();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: `履歴書${format}を保存`, exact: true }).click();
      const download = await downloadPromise;
      expect(await download.failure()).toBeNull();
      const outputPath = testInfo.outputPath(`photo-continuation.${extension}`);
      await download.saveAs(outputPath);
      const buffer = await readFile(outputPath);
      const zip = await JSZip.loadAsync(buffer);
      const media = Object.values(zip.files).filter((file) => !file.dir && /(?:word|xl)\/media\//.test(file.name));
      expect(media.length).toBeGreaterThan(0);
      let content: string;
      if (extension === 'docx') {
        content = await zip.file('word/document.xml')!.async('string');
        expect(content.match(/<w:sectPr>/g)).toHaveLength(paperFormat === 'a4-portrait' ? 3 : 2);
        expect(content).toContain(paperFormat === 'a4-portrait'
          ? 'w:w="11906" w:h="16838"' : 'w:w="23811" w:h="16838"');
      } else {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
        const visibleSheets = workbook.worksheets.filter((sheet) => sheet.state === 'visible');
        expect(visibleSheets).toHaveLength(paperFormat === 'a4-portrait' ? 3 : 2);
        expect(workbook.worksheets[0].getImages()).toHaveLength(1);
        for (const sheet of visibleSheets) {
          expect(sheet.pageSetup.orientation).toBe(paperFormat === 'a4-portrait' ? 'portrait' : 'landscape');
          expect(sheet.pageSetup.paperSize).toBe(paperFormat === 'a4-portrait' ? 9 : 8);
          expect(sheet.pageSetup.printArea).toMatch(/^A1:/);
        }
        content = JSON.stringify(visibleSheets.map((sheet) => sheet.getSheetValues()));
      }
      expect(content).toContain('引き継ぎテスト');
      for (let row = 1; row <= 31; row++) expect(content).toContain(`確認用履歴${row}番`);
      expect(content).not.toContain('非公開作業メモ');
      expect(content).not.toContain('今回は含めない配慮事項');
    }
  });
}
