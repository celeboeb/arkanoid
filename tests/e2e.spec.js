import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const OUT = process.env.SCREENSHOT_DIR || '/opt/cursor/artifacts/screenshots';

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
});

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  return errors;
}

test('menu, gameplay and level progression', async ({ page }, testInfo) => {
  const errors = trackErrors(page);
  await page.goto('/arkanoid/?e2e=1');
  await expect(page.getByRole('heading', { name: 'Арканоид' })).toBeVisible();
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({ path: path.join(OUT, 'menu-neon.png') });
  }

  await page.getByRole('button', { name: 'Играть' }).click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#level-num')).toHaveText('1');
  await page.keyboard.press('Space');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(450);
  await page.keyboard.up('ArrowRight');
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({ path: path.join(OUT, 'gameplay-neon.png') });
  }
  if (testInfo.project.name === 'webkit-mobile') {
    await page.screenshot({ path: path.join(OUT, 'gameplay-mobile.png') });
  }

  await page.evaluate(() => window.__ARKANOID__.completeLevel());
  await expect(page.locator('#level-num')).toHaveText('2', { timeout: 5000 });
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('arkanoid-v1')));
  expect(save.unlocked).toBeGreaterThanOrEqual(2);

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'В меню' }).click();
  await page.getByRole('button', { name: 'Выбор уровня' }).click();
  await expect(page.getByRole('button', { name: /^2\./ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /^3\./ })).toBeDisabled();
  await page.reload();
  await page.getByRole('button', { name: 'Выбор уровня' }).click();
  await expect(page.getByRole('button', { name: /^2\./ })).toBeEnabled();
  await page.getByRole('button', { name: /^2\./ }).click();
  await expect(page.locator('#level-num')).toHaveText('2');
  expect(errors).toEqual([]);
});

test('all four themes switch from settings without restarting the run', async ({ page }, testInfo) => {
  const errors = trackErrors(page);
  await page.goto('/arkanoid/?e2e=1');
  await page.getByRole('button', { name: 'Играть' }).click();
  await expect(page.locator('#hud')).toBeVisible();
  const before = await page.evaluate(() => window.__ARKANOID__.snapshot());

  await page.getByRole('button', { name: 'Настройки' }).click();
  await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({ path: path.join(OUT, 'settings.png') });
  }
  if (testInfo.project.name === 'webkit-mobile') {
    await page.screenshot({ path: path.join(OUT, 'settings-mobile.png') });
  }

  const themes = [
    ['classic', 'Классика 80-х', 'gameplay-classic.png'],
    ['space', 'Космос', 'gameplay-space.png'],
    ['minimal', 'Минимализм', 'gameplay-minimal.png'],
  ];
  for (const [id, label, file] of themes) {
    await page.getByRole('button', { name: label }).click();
    await expect(page.locator('body')).toHaveAttribute('data-theme', id);
    await page.getByRole('button', { name: 'Готово' }).click();
    await expect(page.locator('#hud')).toBeVisible();
    await expect(page.locator('#level-num')).toHaveText('1');
    const after = await page.evaluate(() => window.__ARKANOID__.snapshot());
    expect(after.runId).toBe(before.runId);
    expect(after.level).toBe(before.level);
    if (testInfo.project.name === 'chromium') {
      await page.screenshot({ path: path.join(OUT, file) });
    }
    if (id !== 'minimal') await page.locator('#btn-hud-settings').click();
  }

  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'minimal');
  await expect(page.getByRole('heading', { name: 'Арканоид' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('pwa manifest and service worker are served from the subpath', async ({ request }) => {
  const htmlRes = await request.get('/arkanoid/');
  expect(htmlRes.ok()).toBeTruthy();
  const html = await htmlRes.text();
  const version = html.match(/main\.js\?v=([0-9.]+)/)[1];

  const manifestRes = await request.get('/arkanoid/manifest.json');
  expect(manifestRes.ok()).toBeTruthy();
  const manifest = await manifestRes.json();
  expect(manifest.start_url).toBe('./');
  expect(manifest.scope).toBe('./');
  for (const icon of manifest.icons) expect(icon.src.startsWith('./')).toBeTruthy();

  const swRes = await request.get('/arkanoid/sw.js');
  expect(swRes.ok()).toBeTruthy();
  const sw = await swRes.text();
  expect(sw).toContain(`VERSION = '${version}'`);
  expect(sw).toContain(`?v=${version}`);

  const icon = await request.get('/arkanoid/icons/icon-192.png');
  expect(icon.ok()).toBeTruthy();
});
