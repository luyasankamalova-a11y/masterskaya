// Сквозной тест интерфейса «Моей Мастерской» в headless Chromium.
// Проходит весь сценарий этапа 0 так, как это делал бы пользователь.
//   node tests/e2e.mjs --serve dist          (после npm run build)
//   node tests/e2e.mjs --url http://localhost:5173/
import { chromium } from 'playwright';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { serve } from './serve.mjs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const srv = arg('--url') ? { url: arg('--url'), close() {} } : await serve(resolve(arg('--serve') ?? 'dist'));
const base = srv.url;

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : '  → ' + detail}`); };
const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, e.message.split('\n')[0]); } };

const browser = await chromium.launch();
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
const centerOf = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

await page.goto(base);
await page.waitForSelector('.world');

await step('Мир', async () => {
  check('мир: 9 областей на карте', (await page.locator('.area').count()) === 9);
  check('пустой старт: нет ни одного объекта', (await page.locator('.area__stars i').count()) === 0);
});

await step('Главная', async () => {
  await enterArea('home');
  check('Главная пуста и приглашает к действию', await page.getByText('Положить первую мысль').isVisible());
  await page.getByText('Положить первую мысль').click();
  await page.fill('[data-testid=add-title]', 'Дом внутри горы');
  await page.click('[data-testid=add-save]');
  await page.waitForTimeout(400);
  check('идея появилась на карте', await node('Дом внутри горы').isVisible());
  await page.reload();
  await page.waitForSelector('.map__node .node');
  check('идея сохранилась после перезагрузки', await node('Дом внутри горы').isVisible());
  const readPos = () => page.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('masterskaya');
    r.onsuccess = () => {
      const q = r.result.transaction('placements').objectStore('placements').getAll();
      q.onsuccess = () => { const p = q.result.find((x) => x.spaceId === 'space:home' && !x.deletedAt); r.result.close(); res({ x: p.x, y: p.y }); };
    };
  }));
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
  check('дисциплина на карте кампуса', await node('Механика грунтов').isVisible());
  await dbl(node('Механика грунтов'));
  check('двойное нажатие открывает карту дисциплины', (await page.textContent('[data-testid=where]')) === 'Механика грунтов');
  await addViaSheet({ type: 'Тема', title: 'Основания' });
  await addViaSheet({ type: 'Задание', title: 'Практическая работа №2', due: '2026-10-18' });
  check('тема и задание на карте дисциплины', (await nodes().count()) === 2);
  check('срок задания показан тихо: «до 18 октября»', await node('Практическая').getByText('до 18 октября').isVisible());
  // связь ручкой
  await node('Основания').click();
  await page.waitForTimeout(350);
  const h = await centerOf(node('Основания').locator('[data-handle]'));
  const t = await centerOf(node('Практическая'));
  await page.mouse.move(h.x, h.y); await page.mouse.down();
  await page.mouse.move(t.x, t.y, { steps: 10 }); await page.mouse.up();
  await page.waitForTimeout(400);
  check('связь протянута ручкой от узла к узлу', await page.locator('[data-testid=kindbar]').isVisible());
  await page.locator('[data-testid=kindbar]').getByText('Использую').click();
  await page.locator('[data-testid=kindbar]').getByText('Готово').click();
  check('на карте видна связь с типом', (await page.locator('.edge--using').count()) === 1);
  // статус понимания
  await dbl(node('Основания'));
  await page.locator('[data-testid=panel]').getByRole('button', { name: 'Понимаю' }).click();
  await page.waitForTimeout(300);
  check('статус понимания меняется и виден на узле', await node('Основания').getByText('Понимаю').isVisible());
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
  check('долгое нажатие пальцем открывает меню узла', await page.locator('.menu').isVisible());
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
  check('стилус протягивает связь от узла к узлу', await page.locator('[data-testid=kindbar]').isVisible() && (await page.locator('.edges .edge').count()) > before);
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
  check('PDF добавлен внутри исследования', await node('Подземное строительство').isVisible());
});

await step('Библиотека', async () => {
  await toWorld();
  await addViaSheet({ type: 'Ссылка', title: 'Статья про фундаменты в скале' });
  await enterArea('library');
  const unsorted = page.locator('[data-testid=unsorted]');
  check('быстрое сохранение — в «Неразобранном»', await unsorted.getByText('Статья про фундаменты').isVisible());
  check('PDF из исследования НЕ в «Неразобранном»', !(await unsorted.getByText('Подземное строительство').count()));
  check('PDF из исследования доступен для карты Библиотеки', await page.locator('[data-testid=elsewhere]').getByText('Подземное строительство').isVisible());
  await unsorted.getByText('Статья про фундаменты').click();
  await page.waitForTimeout(400);
  check('материал из лотка встал на карту Библиотеки', await node('Статья про фундаменты').isVisible());
  await page.locator('[data-testid=elsewhere]').getByText('Подземное строительство').click();
  await page.waitForTimeout(400);
  check('тот же PDF на карте Библиотеки — позиция, не копия', (await nodes().count()) === 2);
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
  check('связь с исследованием видна в карточке идеи', await page.locator('[data-testid=links]').getByText('Можно ли построить').isVisible());
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
  check('эскиз лежит в Студии с превью', (await page.locator('.node-type--sketch svg path').count()) === 2);
  await dbl(nodes().first());
  check('эскиз открывается из Студии для редактирования', await page.locator('[data-testid=canvas]').isVisible());
});

await step('Идея → проект', async () => {
  await toWorld();
  await page.waitForTimeout(900);
  check('Сириан тихо показывает, что у него есть мысль', await page.locator('.sirian-dock.has-thought').isVisible());
  await page.click('[data-testid=sirian]');
  await page.locator('[data-testid=proposal]').getByText('Превратить в проект').click();
  await page.waitForSelector('.picklist li');
  await page.waitForTimeout(300);
  check('в списке роста: исследование, PDF, эскиз', (await page.locator('.picklist li').count()) >= 3, String(await page.locator('.picklist li').count()));
  await page.click('[data-testid=grow-confirm]');
  await page.waitForTimeout(800);
  check('открылась карта нового проекта', (await page.textContent('[data-testid=where]')) === 'Дом внутри горы');
  check('на карте проекта: идея, исследование, PDF, эскиз', (await nodes().count()) === 4, String(await nodes().count()));
  check('на карте проекта видно, из какой идеи он вырос', await page.locator('[data-testid=origin]').getByText('Дом внутри горы').isVisible());
  check('исходные связи между ними видны на карте проекта', (await page.locator('.edge--researching, .edge--source, .edge--drew').count()) >= 3);
  await enterArea('home');
  check('идея осталась на Главной', await node('Дом внутри горы').isVisible());
});

await step('Поиск', async () => {
  await page.click('[data-testid=open-search]');
  await page.fill('[data-testid=search-input]', 'фундамент');
  await page.waitForTimeout(300);
  check('поиск «фундамент» находит статью', await page.locator('[data-testid=search-results]').getByText('Статья про фундаменты').isVisible());
  await page.keyboard.press('Escape');
});

await step('Удаление', async () => {
  await enterArea('library');
  await node('Подземное строительство').click({ button: 'right' });
  await page.click('[data-testid=menu-delete]');
  await page.locator('.confirm').getByRole('button', { name: 'Удалить', exact: true }).click();
  await page.waitForTimeout(400);
  check('удалённый PDF исчез с карты Библиотеки', !(await node('Подземное строительство').count()));
  await page.click('[data-testid=open-search]');
  await page.fill('[data-testid=search-input]', 'Подземное');
  await page.waitForTimeout(300);
  check('удалённый PDF больше нигде не находится', (await page.locator('[data-testid=search-results] button').count()) === 0);
  await page.keyboard.press('Escape');
});

let archivePath;
await step('Экспорт / импорт', async () => {
  await page.click('[data-testid=open-settings]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid=export]')]);
  archivePath = join(mkdtempSync(join(tmpdir(), 'm-')), 'archive.json');
  await dl.saveAs(archivePath);
  await page.getByRole('button', { name: 'Удалить всё' }).click();
  await page.locator('.confirm').getByRole('button', { name: 'Удалить всё' }).click();
  await page.waitForTimeout(500);
  check('после очистки мир пуст', (await page.locator('.area__stars i').count()) === 0);
  await page.click('[data-testid=open-settings]');
  await page.setInputFiles('[data-testid=import-file]', archivePath);
  await page.locator('.confirm').getByRole('button', { name: 'Заменить' }).click();
  await page.waitForTimeout(800);
  check('импорт вернул всю Мастерскую', (await page.locator('.area__stars i').count()) > 5);
  await enterArea('home');
  check('после импорта идея на месте', await node('Дом внутри горы').isVisible());
});

await step('Демо-режим', async () => {
  await page.click('[data-testid=open-settings]');
  await page.click('[data-testid=mode-demo]');
  await page.waitForSelector('.world');
  check('демо начинается со своей пустой базы', (await page.locator('.area__stars i').count()) === 0);
  await page.click('[data-testid=open-settings]');
  await page.click('[data-testid=seed-demo]');
  await page.waitForTimeout(1200);
  check('демо-пример создан', (await page.locator('.area__stars i').count()) > 5);
  await page.click('[data-testid=open-settings]');
  await page.getByRole('radio', { name: 'Моя Мастерская' }).click();
  await page.waitForSelector('.world');
  await enterArea('campus');
  check('реальная Мастерская не смешалась с демо', (await nodes().count()) === 1);
});

await step('Офлайн', async () => {
  const swReady = await page.evaluate(async () => { const r = await navigator.serviceWorker?.ready; return !!r?.active; });
  if (!swReady) { check('офлайн: service worker не активен в этом режиме (dev)', true); return; }
  await page.reload();
  await page.waitForTimeout(500);
  await ctx.setOffline(true);
  await page.goto(base + '#/');
  await page.reload();
  await page.waitForSelector('.world', { timeout: 8000 });
  await page.click('[data-testid=area-home]');
  await page.waitForSelector('.map__node .node');
  check('без сети приложение открывается и данные на месте', await node('Дом внутри горы').isVisible());
  await ctx.setOffline(false);
});

check('нет ошибок в консоли', errors.length === 0, errors.join(' | '));
await browser.close();
srv.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} проверок интерфейса пройдено`);
process.exit(failed ? 1 : 0);
