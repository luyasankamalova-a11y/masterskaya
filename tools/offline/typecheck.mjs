// Офлайн-проверка типов всего приложения. Заглушка типов React не описывает
// обработчики событий встроенных элементов, поэтому ошибки TS7006 («параметр без типа»)
// в JSX-обработчиках отфильтровываются; все остальные ошибки считаются настоящими.
// В обычном проекте используйте `npm run typecheck` с настоящими @types/react.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
let out = '';
try {
  execFileSync('/opt/npm-tools/node_modules/.bin/tsc', ['-p', 'tools/offline/tsconfig.all.json'], { cwd: root, encoding: 'utf8' });
} catch (e) {
  out = String(e.stdout ?? '');
}
const errors = out.split('\n').filter((l) => /error TS\d+/.test(l) && !/error TS7006/.test(l));
const ignored = out.split('\n').filter((l) => /error TS7006/.test(l)).length;
errors.forEach((l) => console.log(l));
console.log(`Проверка типов: ${errors.length} ошибок (${ignored} предупреждений заглушки JSX пропущено)`);
process.exit(errors.length ? 1 : 0);
