// Проверка, что каждый пакет, который код и скрипты импортируют напрямую,
// объявлен в package.json (dependencies — для приложения, devDependencies — для сборки и тестов).
// Работает без сети: читает только исходники и package.json.
//   npm run check:deps
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const deps = new Set(Object.keys(pkg.dependencies ?? {}));
const devDeps = new Set(Object.keys(pkg.devDependencies ?? {}));
const builtins = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));

// Импорты, которые идут не через import/from, а через поиск пакета по имени (tests/modules.mjs).
const DYNAMIC = /(?:importPkg|requirePackages|pkgFile|hasPkg)\(\s*\[?([^)\]]*)/g;
const STATIC = /(?:^|[\s;])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm;

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    if (['node_modules', 'dist', 'dist-offline', '.git'].includes(f)) continue;
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(m?[jt]sx?)$/.test(f) && !f.endsWith('.d.ts')) files.push(p);
  }
};
['src', 'tests', 'tools', 'vite.config.ts'].forEach((p) => { const full = join(root, p); statSync(full).isDirectory() ? walk(full) : files.push(full); });

const pkgName = (spec) => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
const problems = [];
for (const file of files) {
  const rel = relative(root, file).replaceAll('\\', '/');
  const src = readFileSync(file, 'utf8');
  const specs = [];
  for (const m of src.matchAll(STATIC)) specs.push(m[1] ?? m[2] ?? m[3]);
  for (const m of src.matchAll(DYNAMIC)) for (const s of m[1].matchAll(/'([^']+)'/g)) if (!s[1].includes('/')) specs.push(s[1]);
  for (const spec of specs) {
    if (!spec || spec.startsWith('.') || spec.startsWith('/') || builtins.has(spec) || spec.startsWith('virtual:')) continue;
    const name = pkgName(spec);
    const isApp = rel.startsWith('src/');
    if (isApp && !deps.has(name)) problems.push(`${rel}: «${name}» используется приложением, но не указан в dependencies`);
    if (!isApp && !deps.has(name) && !devDeps.has(name)) problems.push(`${rel}: «${name}» не указан ни в dependencies, ни в devDependencies`);
  }
}
// Типы React нужны для `npm run typecheck`
for (const t of ['@types/react', '@types/react-dom', 'typescript', 'vite']) if (!devDeps.has(t)) problems.push(`package.json: нет «${t}» в devDependencies`);

if (problems.length) { problems.forEach((p) => console.log('✗ ' + p)); process.exit(1); }
console.log(`✓ Все прямые импорты объявлены в package.json (проверено файлов: ${files.length})`);
