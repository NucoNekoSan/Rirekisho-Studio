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
