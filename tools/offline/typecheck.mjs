// Проверка типов.
//  • Если установлены настоящие typescript, @types/react и vite (после npm install) —
//    запускается `tsc --noEmit -p tsconfig.json` без каких-либо фильтров.
//  • Если настоящих типов React нет (среда без npm), проверка идёт с заглушкой типов
//    tools/offline/types/react.d.ts. Она не описывает обработчики встроенных JSX-элементов,
//    поэтому пропускаются ТОЛЬКО ошибки TS7006 в строках вида onXxx={(e) => …}.
//    Это НЕ замена настоящей проверке, и скрипт так и пишет.
//  • Если компилятора нет или он не запустился — выход с ошибкой, а не «0 ошибок».
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hasPkg, pkgFile, root } from '../../tests/modules.mjs';

const tsc = pkgFile('typescript', 'bin/tsc');
if (!tsc) {
  console.error('✗ Проверка типов НЕ выполнена: компилятор TypeScript не найден (npm install или MASTERSKAYA_NODE_MODULES).');
  process.exit(2);
}
const real = hasPkg('@types/react') && hasPkg('@types/react-dom') && hasPkg('vite');
const project = real ? 'tsconfig.json' : 'tools/offline/tsconfig.all.json';
console.log(real
  ? 'Проверка типов: настоящий TypeScript + настоящие @types/react (tsconfig.json)'
  : 'Проверка типов: ОФЛАЙН-РЕЖИМ — настоящих @types/react нет, используется заглушка типов React. Это не замена `npm run typecheck`.');

const r = spawnSync(process.execPath, [tsc, '--noEmit', '-p', project], { cwd: root, encoding: 'utf8' });
if (r.error) {
  console.error(`✗ Компилятор не запустился: ${r.error.message}`);
  process.exit(2);
}
const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
const lines = out.split('\n').filter((l) => /error TS\d+/.test(l));

/** TS7006 в обработчике события встроенного элемента — артефакт заглушки, а не ошибка кода. */
function isShimArtifact(line) {
  if (real || !/error TS7006/.test(line)) return false;
  const m = /^(.+?)\((\d+),(\d+)\)/.exec(line);
  if (!m) return false;
  const src = readFileSync(join(root, m[1]), 'utf8').split('\n')[Number(m[2]) - 1] ?? '';
  const col = Number(m[3]) - 1;
  // параметр должен стоять прямо в списке параметров обработчика onXxx={(…) =>
  const before = src.slice(0, col);
  const at = before.search(/on[A-Z]\w*=\{[^{}]*$/);
  return at >= 0 && /^on[A-Z]\w*=\{\s*(async\s*)?\(?[\w\s,]*$/.test(before.slice(at));
}

const errors = lines.filter((l) => !isShimArtifact(l));
const skipped = lines.length - errors.length;
if (r.status !== 0 && !lines.length) {
  console.error('✗ Компилятор завершился с ошибкой, но без сообщений TS:\n' + out);
  process.exit(1);
}
errors.forEach((l) => console.log(l));
console.log(`${errors.length ? '✗' : '✓'} Ошибок типов: ${errors.length}${skipped ? ` (пропущено артефактов заглушки JSX: ${skipped})` : ''}`);
process.exit(errors.length ? 1 : 0);
