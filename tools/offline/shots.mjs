// Скриншоты для визуальной проверки: демо-база, планшет горизонтально/вертикально и телефон.
import { resolve } from 'node:path';
import { serve } from '../../tests/serve.mjs';
import { importPkg, requirePackages } from '../../tests/modules.mjs';

requirePackages(['playwright'], 'Скриншоты');
const { chromium } = await importPkg('playwright');

const out = process.argv[2] ?? '/tmp';
const srv = await serve(resolve(import.meta.dirname, '../../dist-offline'));
const browser = await chromium.launch();
const errors = [];
async function session(name, viewport) {
  const ctx = await browser.newContext({ viewport, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(srv.url);
  await page.evaluate(() => localStorage.setItem('masterskaya.mode', 'demo'));
  await page.reload();
  await page.waitForSelector('.world');
  {
    await page.click('[data-testid=open-settings]');
    await page.click('[data-testid=seed-demo]');
    await page.waitForTimeout(1500);
  }
  const shot = (n) => page.screenshot({ path: `${out}/${name}-${n}.png` });
  const area = async (k) => { await page.goto(srv.url + '#/'); await page.click(`[data-testid=area-${k}]`); await page.waitForTimeout(900); };
  await page.waitForTimeout(3000); // тост уходит
  await shot('world');
  await area('home'); await shot('home');
  await area('research-hub');
  await page.mouse.dblclick(...(await page.locator('.map__node .node').first().boundingBox().then((b) => [b.x + 30, b.y + 30])));
  await page.waitForTimeout(900); await shot('research');
  await area('campus');
  await page.mouse.dblclick(...(await page.locator('.map__node .node').first().boundingBox().then((b) => [b.x + 30, b.y + 30])));
  await page.waitForTimeout(900); await shot('discipline');
  await page.locator('.map__node .node', { hasText: 'Основания' }).dblclick();
  await page.waitForTimeout(500); await shot('panel');
  await page.keyboard.press('Escape');
  await area('studio');
  await page.locator('.map__node .node').first().dblclick();
  await page.waitForTimeout(900); await shot('studio');
  await page.goto(srv.url + '#/');
  await page.click('[data-testid=sirian]'); await page.waitForTimeout(600); await shot('sirian');
  await page.keyboard.press('Escape');
  await area('home'); await page.click('[data-testid=open-add]'); await page.waitForTimeout(300); await shot('add');
  await ctx.close();
}
await session('land', { width: 1280, height: 800 });
await session('port', { width: 800, height: 1180 });
await session('phone', { width: 390, height: 844 });
console.log(errors.length ? 'ОШИБКИ:\n' + errors.join('\n') : 'без ошибок');
await browser.close(); srv.close();
