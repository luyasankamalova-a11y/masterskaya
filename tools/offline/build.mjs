// ОФЛАЙН-СБОРКА для среды разработки без доступа к npm.
// Обычная сборка проекта — `npm run build` (Vite). Этот скрипт собирает тот же src/
// через esbuild, подменяя dexie и zustand совместимыми заглушками из tools/offline/.
//   node tools/offline/build.mjs [outDir]
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, process.argv[2] ?? 'dist-offline');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });
cpSync(join(root, 'public'), out, { recursive: true });

const result = await esbuild.build({
  absWorkingDir: root,
  entryPoints: ['src/main.tsx'],
  bundle: true,
  outdir: join(out, 'assets'),
  entryNames: 'app-[hash]',
  format: 'esm',
  minify: true,
  sourcemap: false,
  target: ['es2020', 'safari15'],
  jsx: 'automatic',
  metafile: true,
  alias: {
    dexie: join(root, 'tools/offline/dexie.ts'),
    zustand: join(root, 'tools/offline/zustand.ts'),
  },
  nodePaths: ['/opt/npm-tools/node_modules'],
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false' },
  logLevel: 'warning',
});

const files = Object.keys(result.metafile.outputs).map((p) => relative(out, resolve(root, p)).replaceAll('\\', '/'));
const js = files.find((f) => f.endsWith('.js'));
const css = files.find((f) => f.endsWith('.css'));
const html = readFileSync(join(root, 'index.html'), 'utf8').replace(
  '<script type="module" src="/src/main.tsx"></script>',
  `${css ? `<link rel="stylesheet" href="./${css}">\n  ` : ''}<link rel="manifest" href="./manifest.webmanifest">\n  <script type="module" src="./${js}"></script>\n  <script>if('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));</script>`,
);
writeFileSync(join(out, 'index.html'), html);

// Манифест и простой service worker — аналог того, что генерирует vite-plugin-pwa.
writeFileSync(join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'Моя Мастерская', short_name: 'Мастерская', start_url: './', scope: './', display: 'standalone',
  background_color: '#0d1828', theme_color: '#0d1828', lang: 'ru',
  icons: [{ src: './icon-192.png', sizes: '192x192', type: 'image/png' }, { src: './icon-512.png', sizes: '512x512', type: 'image/png' }],
}, null, 2));
const list = [];
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : list.push('./' + relative(out, p).replaceAll('\\', '/')); });
walk(out);
writeFileSync(join(out, 'sw.js'), `const C='masterskaya-${Date.now().toString(36)}';const F=${JSON.stringify(['./', ...list])};
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;e.respondWith(caches.match(r,{ignoreSearch:true}).then(h=>h||fetch(r).catch(()=>caches.match('./'))));});`);

console.log(`Офлайн-сборка готова: ${relative(root, out)}/ (${js}${css ? ', ' + css : ''})`);
