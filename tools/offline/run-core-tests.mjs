// Запуск теста ядра в headless Chromium (настоящий IndexedDB).
import * as esbuild from 'esbuild';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '../..');
const dir = join(root, 'tools/offline/.core-test');
mkdirSync(dir, { recursive: true });
await esbuild.build({
  absWorkingDir: root, entryPoints: ['tests/core.journey.ts'], bundle: true, format: 'esm',
  outfile: join(dir, 'core.js'), alias: { dexie: join(root, 'tools/offline/dexie.ts') }, logLevel: 'warning',
});
writeFileSync(join(dir, 'index.html'), '<!doctype html><meta charset="utf-8"><script type="module" src="core.js"></script>');
const server = createServer((req, res) => {
  const f = req.url === '/' ? 'index.html' : req.url.slice(1);
  try { res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); res.end(readFileSync(join(dir, f))); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror', e));
await page.goto(url);
await page.waitForFunction(() => 'runCoreTests' in window);
const results = await page.evaluate(() => window.runCoreTests());
await browser.close();
server.close();

let failed = 0;
for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : '  ' + r.detail}`);
  if (!r.ok) failed++;
}
console.log(`\n${results.length - failed}/${results.length} проверок ядра пройдено`);
process.exit(failed ? 1 : 0);
