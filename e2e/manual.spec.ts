import { expect, test } from '@playwright/test';

test('manual runs under the deployment CSP and supports chapter navigation', async ({ page }) => {
  const response = await page.goto('/manual/index.html');
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");
  await expect(page.getByRole('heading', { name: 'Rirekisho Studio マニュアル' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rirekisho Studio 利用者向けマニュアル' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'トップへ戻る' })).toHaveAttribute('href', 'https://resume.nuconeko-garden.com/');
  await expect(page.getByRole('link', { name: '履歴書作成画面へ戻る' })).toHaveAttribute('href', 'https://resume.nuconeko-garden.com/app');

  await page.getByRole('link', { name: '3. 入力ガイド' }).click();
  await expect(page).toHaveURL(/#03-input-guide$/);
  await expect(page.getByRole('heading', { name: '第3章 入力ガイド' })).toBeVisible();
  await expect(page.getByRole('link', { name: '履歴書作成画面へ戻る' })).toBeVisible();
});

test('manual return actions remain usable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/manual/index.html');

  await expect(page.getByRole('link', { name: 'トップへ戻る' })).toBeVisible();
  await expect(page.getByRole('link', { name: '履歴書作成画面へ戻る' })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
});

test('manual chapters remain available after the app is installed and goes offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);

  try {
    await page.goto('/manual/index.html');
    await expect(page.getByRole('heading', { name: 'Rirekisho Studio 利用者向けマニュアル' })).toBeVisible();
    await page.getByRole('link', { name: '7. よくある質問' }).click();
    await expect(page.getByRole('heading', { name: '第7章 よくある質問・トラブル対処' })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
