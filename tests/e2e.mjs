// Сквозной тест интерфейса «Моей Мастерской» в headless Chromium.
// Проходит весь сценарий этапа 0 так, как это делал бы пользователь.
//   node tests/e2e.mjs --serve dist          (после npm run build)
//   node tests/e2e.mjs --url http://localhost:5173/
// Проверки двух видов: что видно на экране и что реально записано в IndexedDB.
// Нужны пакет playwright и браузер Chromium (`npx playwright install chromium`).
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { serve } from './serve.mjs';
import { importPkg, requirePackages } from './modules.mjs';

requirePackages(['playwright'], 'Сквозной тест');
const { chromium } = await importPkg('playwright');

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const srv = arg('--url') ? { url: arg('--url'), close() {} } : await serve(resolve(arg('--serve') ?? 'dist'));
const base = srv.url;

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : '  → ' + detail}`); };
const skipped = [];
const skip = (name, why) => { skipped.push(name); console.log(`− ПРОПУЩЕНО: ${name} (${why})`); };
const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, e.message.split('\n')[0]); } };

let browser;
try { browser = await chromium.launch(); }
catch (e) {
  console.error(`✗ Сквозной тест НЕ выполнен: Chromium не запускается (${e.message.split('\n')[0]}). Выполните: npx playwright install chromium`);
  srv.close();
  process.exit(2);
}
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// .map__node — точка привязки нулевого размера; видимая карточка — .node внутри неё
const nodes = () => page.locator('.map__node .node');
const node = (title) => page.locator('.map__node .node', { hasText: title }).first();
const toWorld = async () => { await page.goto(base + '#/'); await page.waitForSelector('.world'); };
const enterArea = async (kind) => { await toWorld(); await page.click(`[data-testid=area-${kind}]`); await page.waitForSelector('[data-testid=map]'); await page.waitForTimeout(300); };
const addViaSheet = async ({ type, title, file, due }) => {
  await page.click('[data-testid=open-add]');
  if (type) await page.getByRole('radio', { name: type, exact: false }).first().click();
  if (file) await page.setInputFiles('[data-testid=add-file]', file);
  await page.fill('[data-testid=add-title]', title);
  if (due) await page.fill('[data-testid=add-due]', due);
  await page.click('[data-testid=add-save]');
  await page.waitForTimeout(350);
};
const dbl = async (loc) => { const b = await loc.boundingBox(); await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(400); };
/** Ждать, пока элемент станет видимым (до 5 с), — без зависимости от скорости машины. */
const vis = (loc) => loc.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
/** Ждать, пока число элементов станет равным n (до 5 с). */
const countIs = async (loc, n) => { for (let i = 0; i < 50; i++) { if ((await loc.count()) === n) return true; await page.waitForTimeout(100); } return false; };
/** Ждать, пока условие станет истинным (до 5 с). */
const eventually = async (fn) => { for (let i = 0; i < 50; i++) { if (await fn()) return true; await page.waitForTimeout(100); } return false; };
/** Прочитать таблицу IndexedDB напрямую (то, что реально сохранено). */
const idb = (dbName, table) => page.evaluate(([n, t]) => new Promise((res, rej) => {
  const r = indexedDB.open(n);
  r.onsuccess = () => {
    const d = r.result;
    if (!d.objectStoreNames.contains(t)) { d.close(); res([]); return; }
    const q = d.transaction(t).objectStore(t).getAll();
    q.onsuccess = () => { d.close(); res(q.result); };
    q.onerror = () => rej(q.error);
  };
  r.onerror = () => rej(r.error);
}), [dbName, table]);
const live = (rows) => rows.filter((x) => !x.deletedAt);
const real = (t) => idb('masterskaya', t).then(live);
const entityBy = async (title) => (await real('entities')).find((e) => e.title === title);
const centerOf = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

await page.goto(base);
await page.waitForSelector('.world');

await step('Мир', async () => {
  check('мир: 9 областей на карте', await countIs(page.locator('.area'), 9));
  check('пустой старт: в базе нет ни одного объекта (тест начинается с чистого браузера)',
    (await idb('masterskaya', 'entities')).length === 0 && (await idb('masterskaya', 'relations')).length === 0);
  check('пустой старт: созданы только 10 пустых системных пространств', (await idb('masterskaya', 'spaces')).length === 10);
});

await step('Главная', async () => {
  await enterArea('home');
  check('Главная пуста и приглашает к действию', await vis(page.getByText('Положить первую мысль')));
  await page.getByText('Положить первую мысль').click();
  await page.fill('[data-testid=add-title]', 'Дом внутри горы');
  await page.click('[data-testid=add-save]');
  await page.waitForTimeout(400);
  check('идея появилась на карте', await vis(node('Дом внутри горы')));
  await page.reload();
  await page.waitForSelector('.map__node .node');
  check('идея сохранилась после перезагрузки', await vis(node('Дом внутри горы')));
  const idea = await entityBy('Дом внутри горы');
  check('в базе: одна идея, событие в журнале, запись в outbox', idea?.type === 'idea'
    && (await idb('masterskaya', 'events')).some((e) => e.entityId === idea.id && e.type === 'entity.created')
    && (await idb('masterskaya', 'outbox')).some((o) => o.recordId === idea.id));
  const readPos = async () => { const p = (await real('placements')).find((x) => x.spaceId === 'space:home'); return { x: p.x, y: p.y }; };
  const p0 = await readPos();
  const before = await centerOf(node('Дом внутри горы'));
  await page.mouse.move(before.x, before.y);
  await page.mouse.down();
  await page.mouse.move(before.x + 120, before.y + 60, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForSelector('.map__node .node');
  const p1 = await readPos();
  check('перемещение узла сохраняется в базе', Math.abs(p1.x - p0.x - 120) < 15 && Math.abs(p1.y - p0.y - 60) < 15, JSON.stringify({ p0, p1 }));
});

await step('Вуз', async () => {
  await enterArea('campus');
  await addViaSheet({ title: 'Механика грунтов' });
  check('дисциплина на карте кампуса', await vis(node('Механика грунтов')));
  await dbl(node('Механика грунтов'));
  check('двойное нажатие открывает карту дисциплины', (await page.textContent('[data-testid=where]')) === 'Механика грунтов');
  await addViaSheet({ type: 'Тема', title: 'Основания' });
  await addViaSheet({ type: 'Задание', title: 'Практическая работа №2', due: '2026-10-18' });
  check('тема и задание на карте дисциплины', await countIs(nodes(), 2));
  check('срок задания показан тихо: «до 18 октября»', await vis(node('Практическая').getByText('до 18 октября')));
  // связь ручкой
  await node('Основания').click();
  await page.waitForTimeout(350);
  const h = await centerOf(node('Основания').locator('[data-handle]'));
  const t = await centerOf(node('Практическая'));
  await page.mouse.move(h.x, h.y); await page.mouse.down();
  await page.mouse.move(t.x, t.y, { steps: 10 }); await page.mouse.up();
  await page.waitForTimeout(400);
  check('связь протянута ручкой от узла к узлу', await vis(page.locator('[data-testid=kindbar]')));
  await page.locator('[data-testid=kindbar]').getByText('Использую').click();
  await page.locator('[data-testid=kindbar]').getByText('Готово').click();
  check('на карте видна связь с типом', await countIs(page.locator('.edge--using'), 1));
  // изменить тип уже существующей связи в карточке
  await dbl(node('Основания'));
  const relsBefore = (await real('relations')).length;
  const sel = page.locator('[data-testid=links] select').first();
  await sel.selectOption('example');
  await eventually(async () => (await real('relations')).some((r) => r.kind === 'example'));
  await page.keyboard.press('Escape');
  const rels = await real('relations');
  check('тип связи меняется (на карте и в базе), новая связь не создаётся',
    await countIs(page.locator('.edge--example'), 1) && rels.length === relsBefore && rels.some((r) => r.kind === 'example'), `${relsBefore} → ${rels.length}`);
  // статус понимания
  await dbl(node('Основания'));
  await page.locator('[data-testid=panel]').getByRole('button', { name: 'Понимаю' }).click();
  await page.waitForTimeout(300);
  check('статус понимания меняется и виден на узле', await vis(node('Основания').getByText('Понимаю')));
  await page.keyboard.press('Escape');
});

await step('Сенсор и стилус на карте', async () => {
  // мы на карте дисциплины: «Основания» и «Практическая работа №2»
  const fire = (type, x, y, pointerType, id) => page.evaluate(([type, x, y, pointerType, id]) => {
    const el = document.elementFromPoint(x, y) ?? document.querySelector('[data-testid=map]');
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerType, pointerId: id, isPrimary: id === 1, pressure: 0.5, buttons: type === 'pointerup' ? 0 : 1 }));
  }, [type, x, y, pointerType, id]);
  const scale = () => page.evaluate(() => Number(/scale\(([\d.]+)\)/.exec(document.querySelector('.map__layer').style.transform)[1]));
  const z0 = await scale();
  await fire('pointerdown', 300, 200, 'touch', 1); await fire('pointerdown', 400, 200, 'touch', 2);
  for (let i = 1; i <= 6; i++) { await fire('pointermove', 300 - i * 15, 200, 'touch', 1); await fire('pointermove', 400 + i * 15, 200, 'touch', 2); }
  await fire('pointerup', 210, 200, 'touch', 1); await fire('pointerup', 490, 200, 'touch', 2);
  const z1 = await scale();
  check('два пальца масштабируют карту', z1 > z0 * 1.4, `${z0} → ${z1}`);
  const o = await centerOf(node('Основания'));
  await fire('pointerdown', o.x, o.y, 'touch', 3);
  await page.waitForTimeout(700);
  check('долгое нажатие пальцем открывает меню узла', await vis(page.locator('.menu')));
  await fire('pointerup', o.x, o.y, 'touch', 3);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  // стилус: протянуть связь от узла к узлу (сначала разорвём существующую связь через карточку)
  const before = await page.locator('.edges .edge').count();
  await page.evaluate(() => {}); 
  const a = await centerOf(node('Основания'));
  await addViaSheet({ type: 'Вопрос', title: 'Почему грунт оседает?' });
  const q = await centerOf(node('Почему грунт'));
  await fire('pointerdown', a.x, a.y, 'pen', 9);
  for (let i = 1; i <= 8; i++) await fire('pointermove', a.x + ((q.x - a.x) * i) / 8, a.y + ((q.y - a.y) * i) / 8, 'pen', 9);
  await fire('pointerup', q.x, q.y, 'pen', 9);
  await page.waitForTimeout(400);
  check('стилус протягивает связь от узла к узлу', await vis(page.locator('[data-testid=kindbar]')) && (await page.locator('.edges .edge').count()) > before);
  await page.locator('[data-testid=kindbar]').getByText('Готово').click();
});

await step('Исследования', async () => {
  await enterArea('research-hub');
  await addViaSheet({ title: 'Можно ли построить дом внутри горы?' });
  await dbl(node('Можно ли построить'));
  check('у исследования своя карта', (await page.textContent('[data-testid=where]'))?.startsWith('Можно ли'));
  const dir = mkdtempSync(join(tmpdir(), 'm-'));
  const pdf = join(dir, 'underground.pdf');
  writeFileSync(pdf, '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
  await addViaSheet({ type: 'PDF', title: 'Подземное строительство', file: pdf });
  check('PDF добавлен внутри исследования', await vis(node('Подземное строительство')));
});

await step('Библиотека', async () => {
  await toWorld();
  await addViaSheet({ type: 'Ссылка', title: 'Статья про фундаменты в скале' });
  await enterArea('library');
  const unsorted = page.locator('[data-testid=unsorted]');
  check('быстрое сохранение — в «Неразобранном»', await vis(unsorted.getByText('Статья про фундаменты')));
  check('PDF из исследования НЕ в «Неразобранном»', !(await unsorted.getByText('Подземное строительство').count()));
  check('PDF из исследования доступен для карты Библиотеки', await vis(page.locator('[data-testid=elsewhere]').getByText('Подземное строительство')));
  await unsorted.getByText('Статья про фундаменты').click();
  await page.waitForTimeout(400);
  check('материал из лотка встал на карту Библиотеки', await vis(node('Статья про фундаменты')));
  await page.locator('[data-testid=elsewhere]').getByText('Подземное строительство').click();
  await page.waitForTimeout(400);
  check('PDF стоит и в исследовании, и в Библиотеке', await countIs(nodes(), 2));
  const pdfs = (await real('entities')).filter((e) => e.title === 'Подземное строительство');
  const pdfPlaces = pdfs.length === 1 ? (await real('placements')).filter((p) => p.entityId === pdfs[0].id) : [];
  check('в базе один объект PDF и две его позиции — копий нет', pdfs.length === 1 && pdfPlaces.length === 2, `объектов ${pdfs.length}, позиций ${pdfPlaces.length}`);
});

await step('Связь через поиск', async () => {
  await enterArea('home');
  await node('Дом внутри горы').click({ button: 'right' });
  await page.click('[data-testid=menu-link]');
  await page.getByText('Найти в другом месте').click();
  await page.locator('.sheet input').fill('горы');
  await page.locator('.sheet .results button', { hasText: 'Можно ли построить' }).click();
  await page.locator('[data-testid=kindbar]').getByText('Исследую').click();
  await page.locator('[data-testid=kindbar]').getByText('Готово').click();
  await dbl(node('Дом внутри горы'));
  check('связь с исследованием видна в карточке идеи', await vis(page.locator('[data-testid=links]').getByText('Можно ли построить')));
  await page.keyboard.press('Escape');
});

await step('Студия', async () => {
  await enterArea('home');
  await node('Дом внутри горы').click({ button: 'right' });
  await page.getByRole('button', { name: '✏️ Нарисовать' }).click();
  await page.waitForSelector('[data-testid=canvas]');
  const draw = async (x, y) => {
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(x + i * 15, y + Math.sin(i / 2) * 30);
    await page.mouse.up();
  };
  await draw(400, 300); await draw(420, 420);
  const paths = () => page.locator('[data-testid=canvas] svg path').count();
  check('рисование: два штриха', (await paths()) === 2);
  await page.click('[data-testid=undo]');
  check('отмена убирает штрих', (await paths()) === 1);
  await page.click('[data-testid=redo]');
  check('повтор возвращает штрих', (await paths()) === 2);
  // стилус: синтетические события pen с нажимом + касание ладонью во время рисования
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid=canvas]');
    const ev = (type, x, y, pointerType, id, pressure = 0.7) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerType, pointerId: id, pressure, isPrimary: true, buttons: type === 'pointerup' ? 0 : 1 }));
    ev('pointerdown', 600, 250, 'pen', 7);
    ev('pointerdown', 900, 600, 'touch', 8); // ладонь
    for (let i = 1; i < 10; i++) ev('pointermove', 600 + i * 10, 250 + i * 8, 'pen', 7, 0.3 + i * 0.07);
    ev('pointerup', 700, 330, 'pen', 7, 0);
    ev('pointerup', 900, 600, 'touch', 8);
  });
  await page.waitForTimeout(200);
  check('стилус рисует, ладонь игнорируется', (await paths()) === 3);
  // ластик
  await page.click('[data-testid=tool-eraser]');
  await page.mouse.move(420, 380); await page.mouse.down(); await page.mouse.move(520, 440, { steps: 12 }); await page.mouse.up();
  check('ластик стирает штрих', (await paths()) === 2);
  await page.waitForTimeout(900);
  await page.reload();
  await page.waitForSelector('[data-testid=canvas]');
  await page.waitForTimeout(300);
  check('эскиз сохранён и открывается снова (2 штриха)', (await paths()) === 2);
  await enterArea('studio');
  check('эскиз лежит в Студии с превью', await countIs(page.locator('.node-type--sketch svg path'), 2));
  await dbl(nodes().first());
  check('эскиз открывается из Студии для редактирования', await vis(page.locator('[data-testid=canvas]')));
});

await step('Идея → проект', async () => {
  await toWorld();
  await page.waitForTimeout(900);
  check('Сириан тихо показывает, что у него есть мысль', await vis(page.locator('.sirian-dock.has-thought')));
  await page.click('[data-testid=sirian]');
  await page.locator('[data-testid=proposal]').getByText('Превратить в проект').click();
  await page.waitForSelector('.picklist li');
  await page.waitForTimeout(300);
  check('в списке роста: исследование, PDF, эскиз', (await page.locator('.picklist li').count()) >= 3, String(await page.locator('.picklist li').count()));
  // выбор: эскиз НЕ берём в проект
  await page.locator('.picklist li', { hasText: 'Эскиз' }).locator('input').uncheck();
  const entBefore = (await real('entities')).length;
  const relIdsBefore = (await real('relations')).map((r) => r.id);
  await page.click('[data-testid=grow-confirm]');
  await page.waitForTimeout(800);
  check('открылась карта нового проекта', (await page.textContent('[data-testid=where]')) === 'Дом внутри горы');
  check('на карте проекта: идея, исследование, PDF (эскиз не выбран)', await countIs(nodes(), 3) && !(await page.locator('.node-type--sketch').count()), String(await nodes().count()));
  check('на карте проекта видно, из какой идеи он вырос', await vis(page.locator('[data-testid=origin]').getByText('Дом внутри горы')));
  check('исходные связи между ними видны на карте проекта', (await page.locator('.edge--researching, .edge--source').count()) >= 2);
  const ents = await real('entities');
  const project = ents.find((e) => e.type === 'project');
  const idea = ents.find((e) => e.title === 'Дом внутри горы' && e.type === 'idea');
  const rels = await real('relations');
  check('в базе: появился ровно один новый объект — проект', ents.length === entBefore + 1 && !!project);
  check('в базе: идея осталась идеей', !!idea);
  check('в базе: связь «проект —вырос из→ идея»', rels.some((r) => r.kind === 'grew_from' && r.fromId === project?.id && r.toId === idea?.id));
  check('в базе: все прежние связи сохранились', relIdsBefore.every((id) => rels.some((r) => r.id === id)));
  const partOf = rels.filter((r) => r.kind === 'part_of' && r.toId === project?.id).map((r) => ents.find((e) => e.id === r.fromId)?.type).sort();
  check('в базе: выбранные исследование и PDF связаны с проектом, эскиз — нет', partOf.join() === 'pdf,research', partOf.join());
  await enterArea('home');
  check('идея осталась на Главной', await vis(node('Дом внутри горы')));
});

await step('Поиск', async () => {
  await page.click('[data-testid=open-search]');
  await page.fill('[data-testid=search-input]', 'фундамент');
  await page.waitForTimeout(300);
  check('поиск «фундамент» находит статью', await vis(page.locator('[data-testid=search-results]').getByText('Статья про фундаменты')));
  await page.keyboard.press('Escape');
});

await step('Удаление', async () => {
  await enterArea('library');
  await node('Подземное строительство').click({ button: 'right' });
  const pdf = await entityBy('Подземное строительство');
  await page.click('[data-testid=menu-delete]');
  await page.locator('.confirm').getByRole('button', { name: 'Удалить', exact: true }).click();
  await page.waitForTimeout(400);
  check('удалённый PDF исчез с карты Библиотеки', !(await node('Подземное строительство').count()));
  await page.click('[data-testid=open-search]');
  await page.fill('[data-testid=search-input]', 'Подземное');
  await page.waitForTimeout(300);
  check('удалённый PDF больше нигде не находится', await countIs(page.locator('[data-testid=search-results] button'), 0));
  await page.keyboard.press('Escape');
  check('в базе: у удалённого PDF не осталось ни связей, ни позиций, файл удалён',
    !(await entityBy('Подземное строительство'))
    && !(await real('relations')).some((r) => r.fromId === pdf.id || r.toId === pdf.id)
    && !(await real('placements')).some((p) => p.entityId === pdf.id)
    && !(await idb('masterskaya', 'files')).some((f) => pdf.attachments.some((a) => a.fileId === f.id)));
  check('остальные объекты не тронуты', !!(await entityBy('Можно ли построить дом внутри горы?')) && !!(await entityBy('Механика грунтов')));
});

let archivePath;
await step('Экспорт / импорт', async () => {
  const snapshot = async () => Promise.all(['entities', 'relations', 'placements', 'sketches'].map((t) => idb('masterskaya', t).then((r) => r.length)));
  const before = await snapshot();
  await page.click('[data-testid=open-settings]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid=export]')]);
  archivePath = join(mkdtempSync(join(tmpdir(), 'm-')), 'archive.json');
  await dl.saveAs(archivePath);
  await page.getByRole('button', { name: 'Удалить всё' }).click();
  await page.locator('.confirm').getByRole('button', { name: 'Удалить всё' }).click();
  await page.waitForTimeout(500);
  check('после очистки мир пуст и база пуста', await countIs(page.locator('.area__stars i'), 0) && (await idb('masterskaya', 'entities')).length === 0);
  await page.click('[data-testid=open-settings]');
  await page.setInputFiles('[data-testid=import-file]', archivePath);
  await page.locator('.confirm').getByRole('button', { name: 'Заменить' }).click();
  await page.waitForTimeout(800);
  const after = await snapshot();
  check('импорт вернул всю Мастерскую: объекты, связи, позиции, эскизы', before.join() === after.join() && before[0] > 0, `${before} → ${after}`);
  await enterArea('home');
  check('после импорта идея на месте', await vis(node('Дом внутри горы')));
});

await step('Демо-режим', async () => {
  await page.click('[data-testid=open-settings]');
  await page.click('[data-testid=mode-demo]');
  await page.waitForSelector('.world');
  check('демо начинается со своей пустой базы', await countIs(page.locator('.area__stars i'), 0) && (await idb('masterskaya-demo', 'entities')).length === 0);
  await page.click('[data-testid=open-settings]');
  await page.click('[data-testid=seed-demo]');
  await page.waitForTimeout(1200);
  check('демо-пример создан', (await page.locator('.area__stars i').count()) > 5);
  await page.click('[data-testid=open-settings]');
  await page.getByRole('radio', { name: 'Моя Мастерская' }).click();
  await page.waitForSelector('.world');
  await enterArea('campus');
  check('реальная Мастерская не смешалась с демо (на карте Вуза одна своя дисциплина)', await countIs(nodes(), 1));
  const realTitles = (await real('entities')).map((e) => e.title);
  const demoTitles = live(await idb('masterskaya-demo', 'entities')).map((e) => e.title);
  check('в базе: демо-объекты лежат только в masterskaya-demo', demoTitles.includes('Темппелиаукио') && !realTitles.includes('Темппелиаукио'));
  check('в базе: реальные объекты не попали в демо', !demoTitles.includes('Статья про фундаменты в скале'));
});

await step('Офлайн', async () => {
  const swReady = await page.evaluate(() => Promise.race([
    navigator.serviceWorker ? navigator.serviceWorker.ready.then((r) => !!r.active) : Promise.resolve(false),
    new Promise((res) => setTimeout(() => res(false), 5000)),
  ]));
  if (!swReady) { skip('работа без сети', 'service worker не активен — так бывает в режиме npm run dev'); return; }
  await page.reload();
  await page.waitForTimeout(500);
  await ctx.setOffline(true);
  await page.goto(base + '#/');
  await page.reload();
  await page.waitForSelector('.world', { timeout: 8000 });
  await page.click('[data-testid=area-home]');
  await page.waitForSelector('.map__node .node');
  check('без сети приложение открывается и данные на месте', await vis(node('Дом внутри горы')));
  await ctx.setOffline(false);
});

check('нет ошибок в консоли', errors.length === 0, errors.join(' | '));
await browser.close();
srv.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} проверок интерфейса пройдено${skipped.length ? `, пропущено: ${skipped.length} (${skipped.join('; ')})` : ''}`);
process.exit(failed ? 1 : 0);
