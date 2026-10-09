import { expect, test } from '@playwright/test';

test('downloads the default A4 template in both editable formats', async ({ page }, testInfo) => {
  await page.goto('/app');
  for (const [label, extension] of [
    ['履歴書Wordを保存', 'docx'],
    ['履歴書Excelを保存', 'xlsx'],
  ] as const) {
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

  for (const [label, extension] of [
    ['履歴書+配慮事項Wordを保存', 'docx'],
    ['履歴書+配慮事項Excelを保存', 'xlsx'],
  ] as const) {
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
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: label }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`rirekisho.${extension}`);
    expect(await download.failure()).toBeNull();
    await download.saveAs(testInfo.outputPath(`a4.${extension}`));
  }
});
