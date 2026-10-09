import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const XSS_PAYLOAD = '<img src=x onerror="window.__securityXss=1"><script>window.__securityXss=2</script>';

test('deployment headers and HTTP methods enforce the static application boundary', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['referrer-policy']).toBe('no-referrer');
  expect(response.headers()['permissions-policy']).toContain('camera=()');

  const csp = response.headers()['content-security-policy'];
  for (const directive of [
    "default-src 'self'",
    "script-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ]) {
    expect(csp).toContain(directive);
  }
  expect(csp).not.toContain("'unsafe-eval'");
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);

  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE']) {
    const methodResponse = await request.fetch('/', { method });
    expect(methodResponse.status(), `${method} must not be accepted`).toBe(405);
  }
});

test('path traversal and deployment-only file probes do not expose source files', async ({ request }) => {
  const probes = [
    '/package.json',
    '/src/App.tsx',
    '/.git/HEAD',
    '/..%2fpackage.json',
    '/%2e%2e/%2e%2e/package.json',
    '/%252e%252e%252fpackage.json',
  ];

  for (const probe of probes) {
    const response = await request.get(probe);
    expect([200, 404]).toContain(response.status());
    const body = await response.text();
    expect(body, probe).not.toContain('"name": "rirekisho-builder"');
    expect(body, probe).not.toContain('function App()');
    expect(body, probe).not.toMatch(/^ref: refs\/heads\//m);
    if (response.status() === 200) {
      expect(response.headers()['content-type'], probe).toContain('text/html');
      expect(body, probe).toContain('<div id="root">');
    }
  }
});

test('resume input remains inert in the DOM and generated PDF flow', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__securityXss = 0;
    (window as unknown as Record<string, unknown>).__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      ((window as unknown as Record<string, unknown[]>).__cspViolations).push({
        directive: event.violatedDirective,
        blockedUri: event.blockedURI,
      });
    });
  });
  await page.goto('/app');
  await page.getByRole('textbox', { name: '氏名', exact: true }).fill(XSS_PAYLOAD);
  await page.getByRole('textbox', { name: '志望動機', exact: true }).fill(`応募理由 ${XSS_PAYLOAD}`);
  await page.getByRole('textbox', { name: '学歴・職歴1行目の内容' }).fill(XSS_PAYLOAD);

  await expect(page.locator('.preview-panel')).toContainText(XSS_PAYLOAD);
  expect(await page.locator('img[src="x"]').count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__securityXss)).toBe(0);

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: '履歴書PDFを表示' }).click();
  const popup = await popupPromise;
  await expect(popup.locator('iframe')).toHaveAttribute('src', /^blob:/, { timeout: 90_000 });
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  await popup.close();

  expect(await page.evaluate(() => (window as unknown as Record<string, unknown[]>).__cspViolations)).toEqual([]);
});

test('manual Markdown rendering neutralizes HTML and script-scheme links', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__manualXss = 0;
  });
  await page.route('**/manual/INDEX.md', (route) => route.fulfill({
    status: 200,
    contentType: 'text/markdown; charset=utf-8',
    body: `# Security probe\n\n${XSS_PAYLOAD}\n\n[危険リンク](javascript:window.__manualXss=1)`,
  }));

  await page.goto('/manual/index.html');

  await expect(page.getByRole('heading', { name: 'Security probe' })).toBeVisible();
  await expect(page.locator('#content')).toContainText(XSS_PAYLOAD);
  expect(await page.locator('#content img, #content script').count()).toBe(0);
  await expect(page.getByRole('link', { name: '危険リンク' })).toHaveAttribute('href', '#javascript:window.__manualXss=1');
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__manualXss)).toBe(0);
});

test('PII is not persisted or sent outside the documented postal-code request', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:4173' && !['blob:', 'data:'].includes(url.protocol)) {
      externalRequests.push(request.url());
    }
  });
  await page.route('https://zipcloud.ibsnet.co.jp/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      status: 200,
      message: null,
      results: [{ address1: '東京都', address2: '新宿区', address3: '新宿' }],
    }),
  }));

  await page.goto('/app');
  const pii = 'SECURITY-PII-20260716';
  await page.getByRole('textbox', { name: '氏名', exact: true }).fill(pii);
  await page.getByRole('textbox', { name: '電話番号', exact: true }).fill('09011112222');
  await page.getByRole('textbox', { name: '志望動機', exact: true }).fill(pii);
  await page.getByRole('textbox', { name: '郵便番号', exact: true }).fill('1600022');
  await expect(page.getByText('住所を自動入力しました。番地・建物名を確認してください。')).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);

  const persisted = await page.evaluate(async (secret) => {
    const cacheBodies: string[] = [];
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      for (const response of await Promise.all((await cache.keys()).map((request) => cache.match(request)))) {
        if (!response) continue;
        try {
          cacheBodies.push(await response.clone().text());
        } catch {
          // Binary cache entries do not need text inspection.
        }
      }
    }
    const databaseNames = typeof indexedDB.databases === 'function'
      ? (await indexedDB.databases()).map((database) => database.name ?? '')
      : [];
    return {
      localStorage: JSON.stringify({ ...localStorage }),
      sessionStorage: JSON.stringify({ ...sessionStorage }),
      databaseNames,
      cacheContainsSecret: cacheBodies.some((body) => body.includes(secret)),
    };
  }, pii);

  expect(persisted.localStorage).not.toContain(pii);
  expect(persisted.sessionStorage).not.toContain(pii);
  expect(persisted.databaseNames).toEqual([]);
  expect(persisted.cacheContainsSecret).toBe(false);
  expect(externalRequests).toHaveLength(1);
  expect(externalRequests[0]).toBe('https://zipcloud.ibsnet.co.jp/api/search?zipcode=1600022');
  expect(externalRequests[0]).not.toContain(pii);
});

test('malicious project files are rejected or normalized without prototype pollution', async ({ page }) => {
  await page.goto('/app');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '入力データを保存' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const project = JSON.parse(await readFile(downloadPath as string, 'utf8'));

  project.state.resume.basic.name = XSS_PAYLOAD;
  Object.defineProperty(project, '__proto__', { enumerable: true, value: { polluted: 'root' } });
  Object.defineProperty(project.state.resume, '__proto__', { enumerable: true, value: { polluted: 'resume' } });
  await page.getByLabel('入力データを読込').setInputFiles({
    name: 'prototype-probe.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });

  await expect(page.getByRole('textbox', { name: '氏名', exact: true })).toHaveValue(XSS_PAYLOAD);
  expect(await page.evaluate(() => ({} as Record<string, unknown>).polluted)).toBeUndefined();
  expect(await page.locator('img[src="x"]').count()).toBe(0);

  project.includePhoto = true;
  project.state.resume.photo = {
    dataUrl: 'data:image/jpeg;base64,PGh0bWw+PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    size: 34,
    width: 900,
    height: 1200,
    updatedAt: '2026-07-16T00:00:00.000Z',
  };
  await page.getByLabel('入力データを読込').setInputFiles({
    name: 'fake-jpeg.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });

  await expect(page.getByRole('alert')).toContainText('入力データファイルの内容が不正です。');
});
