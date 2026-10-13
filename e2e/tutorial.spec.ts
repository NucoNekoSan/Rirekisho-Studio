import { expect, test } from '@playwright/test';

test('manual tutorial leads through input and export without changing the resume', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app');
  const historyHeading = page.getByRole('textbox', { name: '学歴・職歴1行目の内容' });
  await expect(historyHeading).toHaveValue('学歴');
  await expect(page.locator('.input-tutorial')).toHaveCount(0);

  await page.getByRole('button', { name: 'チュートリアルを始める' }).click();
  for (const title of ['基本情報を入力する', '写真を選ぶ', '学歴・職歴を入力する', '免許・資格を入力する', '志望動機と希望を入力する']) {
    await expect(page.locator('.input-tutorial').getByRole('heading', { name: title })).toBeFocused();
    await page.getByRole('button', { name: '次へ' }).click();
  }
  await expect(page.locator('#preview-panel .input-tutorial').getByRole('heading', { name: '仕上がりを確認する' })).toBeFocused();
  await page.getByRole('button', { name: '次へ' }).click();
  await expect(page.locator('.editor .input-tutorial').getByRole('heading', { name: '入力データと完成ファイルを保存する' })).toBeFocused();
  await page.getByRole('button', { name: '完了' }).click();
  await expect(page.locator('.input-tutorial')).toHaveCount(0);
  await expect(historyHeading).toHaveValue('学歴');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('landing demo edits a sample, exports practice files, and leaves real resumes untouched', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rirekisho-studio:storage-consent', 'device-storage'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('link', { name: '操作デモを試す' }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole('heading', { name: '架空の基本情報を編集する' })).toBeFocused();
  await expect(page.getByLabel('氏名')).toHaveValue('山田 太郎');
  await expect(page.getByText('練習用の操作デモ')).toBeVisible();
  await expect(page.getByText('この端末への保存')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByLabel('氏名').fill('練習中の氏名');
  await expect(page.locator('.preview-panel')).toContainText('練習中の氏名');
  await page.getByRole('button', { name: '学歴・職歴を追加' }).click();
  await expect(page.getByLabel('学歴・職歴7行目の内容')).toBeVisible();
  await page.waitForTimeout(900);
  expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('rirekisho-studio:storage-consent'))).toBe('device-storage');

  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '履歴書PDFを保存' }).click();
  expect((await pdfDownload).suggestedFilename()).toBe('demo-rirekisho.pdf');

  const formatButton = page.getByRole('button', { name: /保存形式を変更/ });
  await formatButton.click();
  await page.getByRole('radio', { name: 'Word（.docx）' }).check();
  const wordDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '履歴書Wordを保存' }).click();
  expect((await wordDownload).suggestedFilename()).toBe('demo-rirekisho.docx');

  await formatButton.click();
  await page.getByRole('radio', { name: 'Excel（.xlsx）' }).check();
  const excelDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '履歴書Excelを保存' }).click();
  expect((await excelDownload).suggestedFilename()).toBe('demo-rirekisho.xlsx');

  await page.getByRole('button', { name: 'デモを最初から' }).click();
  await expect(page.getByLabel('氏名')).toHaveValue('山田 太郎');
  await expect(page.getByRole('button', { name: '履歴書PDFを保存' })).toBeVisible();

  await page.getByRole('link', { name: '新しい履歴書を作成する' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByLabel('氏名')).toHaveValue('');
  await expect(page.getByLabel('学歴・職歴1行目の内容')).toHaveValue('学歴');
  await expect(page.getByText('練習用の操作デモ')).toHaveCount(0);
});
