// Поиск зависимостей для скриптов проверки.
// Порядок: переменная MASTERSKAYA_NODE_MODULES (если задана — только она),
// затем node_modules проекта (после npm install), затем /opt/npm-tools/node_modules
// (предустановленные пакеты среды разработки без доступа к npm).
// Если пакет не найден нигде — скрипт падает с понятным сообщением, а не «проходит».
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const root = resolve(import.meta.dirname, '..');

function candidates() {
  if (process.env.MASTERSKAYA_NODE_MODULES) return [resolve(process.env.MASTERSKAYA_NODE_MODULES)];
  return [join(root, 'node_modules'), '/opt/npm-tools/node_modules'].filter((d) => existsSync(d));
}

/** Папка node_modules, где лежит пакет, или undefined. */
export function locate(pkg) {
  return candidates().find((d) => existsSync(join(d, pkg, 'package.json')));
}

/** Убедиться, что все пакеты есть; иначе завершить процесс с кодом 2 и объяснением. */
export function requirePackages(pkgs, purpose) {
  const missing = pkgs.filter((p) => !locate(p));
  if (missing.length) {
    console.error(`✗ ${purpose}: не найдены пакеты ${missing.join(', ')}.`);
    console.error(`  Искали в: ${candidates().join(', ') || '(нет ни одной папки node_modules)'}`);
    console.error('  Выполните npm install или укажите папку с пакетами в MASTERSKAYA_NODE_MODULES.');
    process.exit(2);
  }
  return Object.fromEntries(pkgs.map((p) => [p, locate(p)]));
}

/** Импорт пакета из найденной папки (ESM не умеет NODE_PATH). */
export async function importPkg(pkg) {
  const dir = locate(pkg);
  if (!dir) throw new Error(`Пакет ${pkg} не найден`);
  const req = createRequire(join(dir, '_resolve.js'));
  const mod = await import(pathToFileURL(req.resolve(pkg)).href);
  // CommonJS-пакеты (playwright) отдают API через default
  return mod.default && typeof mod.default === 'object' ? { ...mod.default, ...mod } : mod;
}

/** Путь к исполняемому файлу пакета (например, typescript/bin/tsc). */
export function pkgFile(pkg, file) {
  const dir = locate(pkg);
  return dir ? join(dir, pkg, file) : undefined;
}

/** Есть ли настоящий пакет (иначе скрипт честно сообщает, что берёт заглушку). */
export const hasPkg = (pkg) => !!locate(pkg);
