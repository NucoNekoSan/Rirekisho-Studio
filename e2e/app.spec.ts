import { expect, test } from '@playwright/test';

test('desktop and mobile layouts do not overflow horizontally', async ({ page }, testInfo) => {
  for (const width of [1600, 1440, 820]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Rirekisho Studio' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole('heading', { name: '基本情報' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: false });
});

test('workspace switches between two and three columns at 1680px', async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 1000 });
  await page.goto('/app');

  const editor = page.locator('.editor');
  const preview = page.locator('.preview-panel');
  const twoColumnLayout = await Promise.all([editor, preview].map((element) => element.boundingBox()));
  expect(twoColumnLayout[0]).not.toBeNull();
  expect(twoColumnLayout[1]).not.toBeNull();
  expect(twoColumnLayout[1]!.y).toBeGreaterThan(twoColumnLayout[0]!.y + twoColumnLayout[0]!.height);

  await page.setViewportSize({ width: 1681, height: 1000 });
  const threeColumnLayout = await Promise.all([editor, preview].map((element) => element.boundingBox()));
  expect(threeColumnLayout[0]).not.toBeNull();
  expect(threeColumnLayout[1]).not.toBeNull();
  expect(threeColumnLayout[1]!.x).toBeGreaterThan(threeColumnLayout[0]!.x + threeColumnLayout[0]!.width);
  expect(Math.abs(threeColumnLayout[1]!.y - threeColumnLayout[0]!.y)).toBeLessThanOrEqual(1);
  expect(threeColumnLayout[0]!.width).toBeGreaterThanOrEqual(829);
});

test('A4 and A3 previews preserve their scoped header backgrounds', async ({ page }) => {
  await page.goto('/app');
  await page.getByRole('button', { name: 'A3横・配慮事項付きデモを入力' }).click();
  const a3Page = page.locator('.preview-panel .resume-a3-page').first();
  await expect(a3Page).toBeVisible();
  await expect(a3Page).toHaveCSS('--resume-header-bg', 'transparent');

  await page.getByRole('radio', { name: 'A4縦（標準）' }).check();
  const a4Page = page.locator('.preview-panel .resume-page').first();
  await expect(a4Page).toBeVisible();
  await expect(a4Page).not.toHaveCSS('--resume-header-bg', 'transparent');
});

test('IME confirmation keeps focus and input in the current field', async ({ page }) => {
  await page.goto('/app');
  const name = page.getByRole('textbox', { name: '氏名', exact: true });
  const furigana = page.getByRole('textbox', { name: 'ふりがな', exact: true });

  await name.fill('佐藤');
  await name.focus();
  await name.evaluate((element) => {
    element.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
      isComposing: true,
    }));
  });
  await expect(name).toBeFocused();
  await expect(name).toHaveValue('佐藤');
  await expect(furigana).toHaveValue('');

  await name.evaluate((element) => {
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'keyCode', { value: 229 });
    element.dispatchEvent(event);
  });
  await expect(name).toBeFocused();

  await name.press('Enter');
  await expect(furigana).toBeFocused();
});

test('long text fields open a large editor, update live, and restore focus', async ({ page }) => {
  await page.goto('/app');
  const motivation = page.locator('#appeal').getByRole('textbox', { name: '志望動機', exact: true });

  await motivation.click();
  const dialog = page.getByRole('dialog', { name: '志望動機を大きく編集' });
  await expect(dialog).toBeVisible();

  const expandedEditor = dialog.getByRole('textbox', { name: '志望動機', exact: true });
  await expandedEditor.fill('大きな画面で文章全体を確認できます。');
  await expect(motivation).toHaveValue('大きな画面で文章全体を確認できます。');
  await expect(dialog.getByText('18 / 350文字')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(motivation).toBeFocused();

  for (const label of ['自己PR', '作業メモ']) {
    const field = page.locator('#appeal').getByRole('textbox', { name: label, exact: true });
    await field.click();
    const expanded = page.getByRole('dialog', { name: `${label}を大きく編集` });
    await expect(expanded).toBeVisible();
    await expanded.getByRole('textbox', { name: label, exact: true }).fill(`${label}の入力確認`);
    await expect(field).toHaveValue(`${label}の入力確認`);
    await page.keyboard.press('Escape');
    await expect(field).toBeFocused();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '作業メモを大きく編集' }).click();
  const memoDialog = page.getByRole('dialog', { name: '作業メモを大きく編集' });
  await expect(memoDialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('PDF display opens a tab before asynchronous generation completes', async ({ page }) => {
  await page.goto('/app');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: '履歴書PDFを表示' }).click();
  const popup = await popupPromise;

  await expect(popup.getByRole('status')).toContainText('PDFを生成しています。');
  await expect(popup.locator('iframe')).toHaveAttribute('src', /^blob:/, { timeout: 90_000 });
  await popup.close();
});

test('A4 output is blocked before fixed pages can clip overflowing content', async ({ page }) => {
  await page.goto('/app');
  await page.getByRole('textbox', { name: '志望動機', exact: true }).fill('応\n'.repeat(150));

  await expect(page.getByRole('alert')).toContainText('A4縦2ページに収まらないため、PDFを表示・保存できません');
  await expect(page.getByRole('button', { name: '履歴書PDFを表示' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '履歴書PDFを保存' })).toBeDisabled();
});

test('motivation, self PR, and requests share their available PDF height on A4 and A3', async ({ page }) => {
  await page.goto('/app');
  await page.getByRole('textbox', { name: '志望動機', exact: true }).fill('短い志望動機です。');
  await page.getByRole('textbox', { name: '自己PR', exact: true }).fill('自'.repeat(350));

  const appealBoxDimensions = async (selector: string) => {
    const boxes = page.locator(selector);
    await expect(boxes).toHaveCount(2);
    return boxes.evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect();
      const body = element.querySelector('p')?.getBoundingClientRect();
      return {
        height: box.height,
        bodyBottom: body?.bottom ?? 0,
        boxBottom: box.bottom,
        bodyScrollHeight: element.querySelector('p')?.scrollHeight ?? 0,
        bodyClientHeight: element.querySelector('p')?.clientHeight ?? 0,
      };
    }));
  };

  const assertAppealBoxesFit = async (selector: string) => {
    const dimensions = await appealBoxDimensions(selector);
    expect(dimensions[1].height).toBeGreaterThan(dimensions[0].height);
    expect(dimensions.every(({ bodyBottom, boxBottom }) => bodyBottom <= boxBottom + 0.5)).toBe(true);
    expect(dimensions.every(({ bodyScrollHeight, bodyClientHeight }) => bodyScrollHeight <= bodyClientHeight + 1)).toBe(true);
    return dimensions;
  };

  const assertRequestsFit = async (selector: string) => {
    const metrics = await page.locator(selector).evaluate((element) => {
      const box = element.getBoundingClientRect();
      const body = element.querySelector('p') as HTMLElement;
      const style = getComputedStyle(body);
      return {
        height: box.height,
        bodyScrollHeight: body.scrollHeight,
        bodyClientHeight: body.clientHeight,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
      };
    });
    expect(metrics.bodyScrollHeight).toBeLessThanOrEqual(metrics.bodyClientHeight + 1);
    expect(Number.parseFloat(metrics.fontSize)).toBeGreaterThan(0);
    expect(Number.parseFloat(metrics.lineHeight)).toBeGreaterThan(0);
    return metrics;
  };

  await assertAppealBoxesFit('.preview-panel .resume-a4-page-2 .resume-a4-text-stack > .resume-text-box:nth-child(-n+2)');
  await assertAppealBoxesFit('.pdf-export-root .resume-a4-page-2 .resume-a4-text-stack > .resume-text-box:nth-child(-n+2)');
  const a4Requests = await assertRequestsFit('.preview-panel .resume-a4-page-2 .resume-text-requests');
  await assertRequestsFit('.pdf-export-root .resume-a4-page-2 .resume-text-requests');
  const a4SelfPrHeight = await page.locator('.preview-panel .resume-a4-page-2 .resume-text-selfPr').evaluate((element) => element.getBoundingClientRect().height);
  expect(a4Requests.height).toBeLessThan(a4SelfPrHeight);

  await page.getByRole('textbox', { name: '本人希望欄', exact: true }).fill('希望事項1\n希望事項2\n希望事項3');
  const expandedA4Requests = await assertRequestsFit('.preview-panel .resume-a4-page-2 .resume-text-requests');
  await assertRequestsFit('.pdf-export-root .resume-a4-page-2 .resume-text-requests');
  expect(expandedA4Requests.height).toBeGreaterThan(a4Requests.height);
  expect(expandedA4Requests.fontSize).toBe(a4Requests.fontSize);
  expect(expandedA4Requests.lineHeight).toBe(a4Requests.lineHeight);

  await page.getByRole('textbox', { name: '本人希望欄', exact: true }).fill('勤務条件については貴社規定に従います。');
  await page.getByRole('textbox', { name: '志望動機', exact: true }).fill('志'.repeat(350));
  for (const selector of [
    '.preview-panel .resume-a4-page-2 .resume-a4-text-stack > .resume-text-box:nth-child(-n+2)',
    '.pdf-export-root .resume-a4-page-2 .resume-a4-text-stack > .resume-text-box:nth-child(-n+2)',
  ]) {
    const dimensions = await appealBoxDimensions(selector);
    expect(dimensions.every(({ bodyBottom, boxBottom }) => bodyBottom <= boxBottom + 0.5)).toBe(true);
    expect(dimensions.every(({ bodyScrollHeight, bodyClientHeight }) => bodyScrollHeight <= bodyClientHeight + 1)).toBe(true);
  }

  await page.getByRole('textbox', { name: '志望動機', exact: true }).fill('短い志望動機です。');
  await page.getByRole('radio', { name: 'A3横（1枚）' }).check();
  await expect(page.locator('.preview-panel .resume-a3-page')).toBeVisible();
  await assertAppealBoxesFit('.preview-panel .resume-a3-appeal-grid > .resume-text-box');
  await assertAppealBoxesFit('.pdf-export-root .resume-a3-appeal-grid > .resume-text-box');
  const a3Requests = await assertRequestsFit('.preview-panel .resume-a3-request-mini .resume-text-requests');
  await assertRequestsFit('.pdf-export-root .resume-a3-request-mini .resume-text-requests');

  await page.getByRole('textbox', { name: '本人希望欄', exact: true }).fill('希望事項1\n希望事項2\n希望事項3');
  const expandedA3Requests = await assertRequestsFit('.preview-panel .resume-a3-request-mini .resume-text-requests');
  await assertRequestsFit('.pdf-export-root .resume-a3-request-mini .resume-text-requests');
  expect(expandedA3Requests.height).toBeGreaterThan(a3Requests.height);
  expect(expandedA3Requests.fontSize).toBe(a3Requests.fontSize);
  expect(expandedA3Requests.lineHeight).toBe(a3Requests.lineHeight);
});

test('input data survives a browser download, clear, and reload round trip', async ({ page }) => {
  await page.goto('/app');
  await page.getByRole('textbox', { name: '氏名', exact: true }).fill('保存確認 太郎');
  await page.getByRole('textbox', { name: '志望動機', exact: true }).fill('保存と読込のブラウザ確認');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '入力データを保存' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  await page.getByRole('button', { name: '入力をすべて消去' }).click();
  await page.getByRole('button', { name: '消去する' }).click();
  await expect(page.getByRole('textbox', { name: '氏名', exact: true })).toHaveValue('');

  await page.getByLabel('入力データを読込').setInputFiles(downloadPath as string);
  await expect(page.getByRole('textbox', { name: '氏名', exact: true })).toHaveValue('保存確認 太郎');
  await expect(page.getByRole('textbox', { name: '志望動機', exact: true })).toHaveValue('保存と読込のブラウザ確認');
});
