import { expect, test } from '@playwright/test';

test('format menu supports keyboard selection without downloading, Escape, and outside dismissal', async ({ page }) => {
  await page.goto('/app');
  let downloads = 0;
  page.on('download', () => downloads++);
  const trigger = page.getByRole('button', { name: /保存形式を変更/ });
  const menu = page.locator('.export-format-menu');
  await trigger.click();
  await expect(page.getByRole('radio', { name: 'PDF（.pdf）' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: 'Word（.docx）' })).toBeChecked();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('button', { name: '履歴書Wordを保存' })).toBeVisible();
  expect(downloads).toBe(0);
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('heading', { name: '仕上がり見本', exact: true }).click();
  await expect(menu).toBeHidden();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '履歴書Wordを保存' }).click();
  expect(await (await download).failure()).toBeNull();
  expect(downloads).toBe(1);
});

test('export controls and top-layer menu fit mobile and narrow desktop columns', async ({ page }, testInfo) => {
  for (const width of [320, 390, 1680, 1681, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/app');
    const panel = page.locator('.export-panel');
    await panel.scrollIntoViewIfNeeded();
    await panel.screenshot({ path: testInfo.outputPath(`export-${width}.png`) });
    const save = page.locator('.export-save');
    expect((await save.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await page.getByRole('button', { name: /保存形式を変更/ }).click();
    const menu = page.locator('.export-format-menu');
    await expect(menu).toBeVisible();
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(1000);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await menu.screenshot({ path: testInfo.outputPath(`menu-${width}.png`) });
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: 'A3横・配慮事項付きデモを入力' }).click();
  await page.getByRole('checkbox', { name: '配慮事項も含める' }).check();
  await expect(page.getByRole('button', { name: '履歴書と配慮事項PDFを保存' })).toBeVisible();
  await page.locator('.export-panel').screenshot({ path: testInfo.outputPath('export-with-accommodation.png') });
  await page.getByRole('checkbox', { name: '配慮事項シートを作成する' }).uncheck();
  await expect(page.getByRole('checkbox', { name: '配慮事項も含める' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '履歴書PDFを保存' })).toBeVisible();
});

test('browsers without Popover API use an inline format disclosure', async ({ page }) => {
  await page.addInitScript(() => { delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover; });
  await page.goto('/app');
  const trigger = page.getByRole('button', { name: /保存形式を変更/ });
  await trigger.click();
  await expect(page.locator('.export-format-menu')).not.toHaveAttribute('popover');
  await page.getByRole('radio', { name: 'Excel（.xlsx）' }).check();
  await expect(page.locator('.export-format-menu')).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('button', { name: '履歴書Excelを保存' })).toBeVisible();
});
