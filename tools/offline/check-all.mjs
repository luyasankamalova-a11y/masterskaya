// Все проверки для среды без доступа к npm, по порядку:
//   зависимости → проверка типов (заглушка типов React) → офлайн-сборка → тест ядра → сквозной тест.
// Итог честный: каждая проверка помечается «пройдена», «НЕ пройдена» или «НЕ выполнена».
// Код выхода 0 — только если все четыре действительно выполнились и прошли.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { root } from '../../tests/modules.mjs';

const steps = [
  ['Зависимости объявлены в package.json', ['tools/check-deps.mjs']],
  ['Проверка типов (офлайн, заглушка типов React)', ['tools/offline/typecheck.mjs']],
  ['Офлайн-сборка (esbuild)', ['tools/offline/build.mjs']],
  ['Тест ядра', ['tests/run-core.mjs']],
  ['Сквозной тест интерфейса', ['tests/e2e.mjs', '--serve', 'dist-offline']],
];
const summary = [];
let blocked = false;
for (const [name, args] of steps) {
  if (blocked) { summary.push([name, 'НЕ выполнена (предыдущий шаг не прошёл)']); continue; }
  console.log(`\n── ${name}`);
  const r = spawnSync(process.execPath, [join(root, args[0]), ...args.slice(1)], { cwd: root, stdio: 'inherit' });
  const status = r.status === 0 ? 'пройдена' : r.status === 2 ? 'НЕ выполнена (нет зависимостей)' : 'НЕ пройдена';
  summary.push([name, status]);
  if (r.status !== 0) blocked = true;
}
console.log('\nИтог:');
summary.forEach(([n, s]) => console.log(`  ${s === 'пройдена' ? '✓' : '✗'} ${n}: ${s}`));
console.log('\nНапоминание: это проверки с заглушками dexie, zustand и типов React.');
console.log('Окончательная проверка — npm install && npm run typecheck && npm run build && npm test.');
process.exit(summary.every(([, s]) => s === 'пройдена') ? 0 : 1);
