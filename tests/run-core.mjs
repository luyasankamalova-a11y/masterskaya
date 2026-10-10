// Тест ядра в headless Chromium (настоящий IndexedDB): tests/core.journey.ts.
//   npm run test:core            (после npm install — с настоящим Dexie)
//   node tests/run-core.mjs      (в среде без npm — с заглушкой dexie, о чём будет сказано)
// Нужны пакеты esbuild и playwright, а также браузер Chromium для Playwright
// (`npx playwright install chromium`).
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hasPkg, importPkg, requirePackages, root } from './modules.mjs';

const found = requirePackages(['esbuild', 'playwright'], 'Тест ядра');
const esbuild = await importPkg('esbuild');
const { chromium } = await importPkg('playwright');

const alias = {};
if (hasPkg('dexie')) console.log('  dexie: настоящий пакет');
else { alias.dexie = join(root, 'tools/offline/dexie.ts'); console.log('  dexie: ЗАГЛУШКА tools/offline/dexie.ts (настоящий пакет не установлен)'); }

const dir = mkdtempSync(join(tmpdir(), 'masterskaya-core-'));
await esbuild.build({
  absWorkingDir: root, entryPoints: ['tests/core.journey.ts'], bundle: true, format: 'esm',
  outfile: join(dir, 'core.js'), alias, nodePaths: [...new Set(Object.values(found))], logLevel: 'warning',
});
writeFileSync(join(dir, 'index.html'), '<!doctype html><meta charset="utf-8"><script type="module" src="core.js"></script>');
const server = createServer((req, res) => {
  const f = req.url === '/' ? 'index.html' : req.url.slice(1);
  try { res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); res.end(readFileSync(join(dir, f))); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);

let browser;
try { browser = await chromium.launch(); }
catch (e) {
  console.error(`✗ Тест ядра НЕ выполнен: Chromium для Playwright не запускается (${e.message.split('\n')[0]}). Выполните: npx playwright install chromium`);
  server.close();
  process.exit(2);
}
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForFunction(() => 'runCoreTests' in window, null, { timeout: 15000 });
const results = await page.evaluate(() => window.runCoreTests());
await browser.close();
server.close();

let failed = 0;
for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : '  ' + r.detail}`);
  if (!r.ok) failed++;
}
if (pageErrors.length) { console.log('✗ Ошибки на странице:\n' + pageErrors.join('\n')); failed++; }
if (!results.length) { console.log('✗ Ни одной проверки не выполнено'); failed++; }
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} проверок ядра пройдено${alias.dexie ? ' (с заглушкой dexie)' : ''}`);
process.exit(failed ? 1 : 0);
