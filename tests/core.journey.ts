// Тест ядра в настоящем браузере (IndexedDB): эталонный путь объекта через систему
// идея → исследование → материал → тема Вуза → эскиз → проект («вырос из»),
// плюс «Неразобранное», удаление каскадом, архив, экспорт/импорт, поиск.
import { db } from '../src/core/db/schema';
import { bootstrap } from '../src/core/repo/bootstrap';
import {
  archiveEntity, createEntity, deleteEntity, growIntoProject, growthAround, linkEntities, restoreEntity, saveSketch, sketchFor,
} from '../src/core/repo/actions';
import {
  allEntities, getEntity, getSketch, materialsElsewhere, neighbours, nodesInSpace, relationsOf, spaceOwnedBy, unsortedMaterials,
} from '../src/core/repo/queries';
import { exportArchive, importArchive, wipeAll } from '../src/core/repo/archive';
import { keywordSearch } from '../src/search/keyword';
import { CAMPUS_ID, HOME_ID, LIBRARY_ID, RESEARCH_ID } from '../src/core/registry/spaces';

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  results.push({ name, ok, detail: ok ? undefined : JSON.stringify(detail) });
}

async function run(): Promise<Result[]> {
  await wipeAll();
  await bootstrap();
  check('пустой старт: 10 системных пространств, 0 объектов', (await db.spaces.count()) === 10 && (await db.entities.count()) === 0);

  // 1. Идея
  const idea = await createEntity({ type: 'idea', title: 'Дом внутри горы', spaceId: HOME_ID, at: { x: 0, y: 0 } });
  const ev1 = await db.events.where('entityId').equals(idea.id).toArray();
  const ob1 = (await db.outbox.toArray()).map((o) => o.table).sort();
  check('commit(): событие в журнале', ev1.length === 1 && ev1[0].type === 'entity.created', ev1);
  check('commit(): объект и позиция в outbox', ob1.join() === 'entities,placements', ob1);

  // 2. Исследование
  const research = await createEntity({ type: 'research', title: 'Можно ли построить дом внутри горы?', spaceId: RESEARCH_ID, linkTo: { id: idea.id, kind: 'researching' } });
  const rSpace = await spaceOwnedBy(research.id);
  check('у исследования своя карта', !!rSpace && rSpace.kind === 'research');

  // 3. Материал внутри исследования
  const pdf = await createEntity({ type: 'pdf', title: 'Подземное строительство', spaceId: rSpace!.id, at: { x: 100, y: 100 } });
  const pdfRels = await relationsOf(pdf.id);
  check('материал в исследовании: связь «источник» с исследованием', pdfRels.some((r) => r.fromId === research.id && r.kind === 'source'), pdfRels);
  check('PDF из исследования НЕ в «Неразобранном»', !(await unsortedMaterials()).some((e) => e.id === pdf.id));
  check('PDF из исследования доступен Библиотеке для размещения', (await materialsElsewhere(LIBRARY_ID)).some((e) => e.id === pdf.id));

  // Быстрое сохранение без места
  const quick = await createEntity({ type: 'link', title: 'Статья про тоннели фундаментов', meta: { url: 'https://example.org' } });
  check('быстрое сохранение без места → «Неразобранное»', (await unsortedMaterials()).some((e) => e.id === quick.id));

  // 4. Тема Вуза
  const disc = await createEntity({ type: 'discipline', title: 'Механика грунтов', spaceId: CAMPUS_ID });
  const dSpace = await spaceOwnedBy(disc.id);
  const topic = await createEntity({ type: 'topic', title: 'Основания', spaceId: dSpace!.id });
  check('тема входит в дисциплину (part_of)', (await relationsOf(topic.id)).some((r) => r.kind === 'part_of' && r.toId === disc.id));
  check('тема получила начальный статус понимания', topic.status === 'not_studied', topic.status);
  const due = await createEntity({ type: 'assignment', title: 'Практическая №2', spaceId: dSpace!.id, meta: { dueDate: '2026-10-18' } });
  check('задание хранит срок', (await getEntity(due.id))?.meta.dueDate === '2026-10-18');
  await linkEntities(pdf.id, topic.id, 'studying');
  const dup = await linkEntities(topic.id, pdf.id, 'example');
  check('повторная связь той же пары не создаётся', (await relationsOf(pdf.id)).filter((r) => r.toId === topic.id || r.fromId === topic.id).length === 1 && dup?.kind === 'studying');

  // 5. Эскиз
  const sketch = await sketchFor(research.id, 'Разрез');
  await saveSketch({ entityId: sketch.id, layers: [{ id: 'l', name: 'Рисунок', visible: true, locked: false }], updatedAt: Date.now(),
    elements: [{ id: 's1', kind: 'stroke', tool: 'pen', color: '#fff', size: 3, layerId: 'l', points: [[0, 0, 0.5], [10, 10, 0.5]] }] });
  check('эскиз сохраняется как структура (штрихи)', (await getSketch(sketch.id))?.elements.length === 1);
  check('эскиз связан с исследованием («нарисовала»)', (await relationsOf(sketch.id)).some((r) => r.kind === 'drew' && r.toId === research.id));
  check('сохранение эскиза попало в outbox', (await db.outbox.toArray()).some((o) => o.table === 'sketches' && o.recordId === sketch.id));

  // 6. Идея выросла
  const grown = (await growthAround(idea.id)).map((e) => e.id);
  check('вокруг идеи выросли исследование, материал и эскиз', [research.id, pdf.id, sketch.id].every((id) => grown.includes(id)), grown);
  check('тема Вуза (3 шага) не попадает в рост по умолчанию', !grown.includes(topic.id));

  // 7. Превратить в проект
  const before = await db.entities.count();
  const relsBefore = (await db.relations.toArray()).filter((r) => !r.deletedAt).map((r) => r.id);
  const project = await growIntoProject(idea.id, { includeIds: grown });
  check('создан ровно один новый объект (без дубликатов)', (await db.entities.count()) === before + 1);
  check('идея осталась идеей', (await getEntity(idea.id))?.type === 'idea');
  check('связь Project —вырос из→ Idea', (await relationsOf(idea.id)).some((r) => r.fromId === project!.id && r.kind === 'grew_from'));
  const pSpace = await spaceOwnedBy(project!.id);
  const onProject = (await nodesInSpace(pSpace!.id)).map((n) => n.entity.id).sort();
  check('на карте проекта: идея, исследование, материал, эскиз', onProject.join() === [idea.id, research.id, pdf.id, sketch.id].sort().join(), onProject);
  const relsAfter = new Set((await db.relations.toArray()).filter((r) => !r.deletedAt).map((r) => r.id));
  check('исходные связи сохранены', relsBefore.every((id) => relsAfter.has(id)));
  const pn = await neighbours(project!.id);
  check('проект связан с содержимым (part_of)', [research.id, pdf.id, sketch.id].every((id) => pn.some((n) => n.entity.id === id && n.relation.kind === 'part_of')), pn.map((n) => n.relation.kind));
  check('идея осталась на Главной', (await nodesInSpace(HOME_ID)).some((n) => n.entity.id === idea.id));

  // Удаление каскадом
  await deleteEntity(pdf.id);
  check('удалённый материал исчез с карты исследования', !(await nodesInSpace(rSpace!.id)).some((n) => n.entity.id === pdf.id));
  check('удалённый материал исчез с карты проекта', !(await nodesInSpace(pSpace!.id)).some((n) => n.entity.id === pdf.id));
  check('связи удалённого материала удалены', (await relationsOf(pdf.id)).length === 0);
  check('остальные объекты не тронуты', !!(await getEntity(research.id)) && !!(await getEntity(topic.id)) && !!(await getEntity(project!.id)));

  // Архив
  await archiveEntity(quick.id);
  check('архивный объект скрыт', !(await allEntities()).some((e) => e.id === quick.id));
  await restoreEntity(quick.id);
  check('архивный объект возвращается', (await allEntities()).some((e) => e.id === quick.id));

  // Поиск
  const hits = await keywordSearch('фундамент');
  check('простой поиск: «фундамент» находит «…фундаментов»', hits.some((h) => h.entity.id === quick.id), hits.map((h) => h.entity.title));
  check('простой поиск: «горы» находит идею и исследование', (await keywordSearch('горы')).length >= 2);

  // Экспорт / импорт
  const counts = async () => Promise.all(['entities', 'relations', 'placements', 'spaces', 'sketches', 'events'].map((t) => db.table(t).count()));
  const c1 = await counts();
  const blob = await exportArchive();
  await wipeAll();
  check('после очистки база пуста', (await db.entities.count()) === 0);
  await importArchive(blob);
  const c2 = await counts();
  check('импорт восстанавливает всю Мастерскую', c1.join() === c2.join(), { c1, c2 });
  check('эскиз пережил экспорт/импорт', (await getSketch(sketch.id))?.elements.length === 1);
  return results;
}

(window as unknown as { runCoreTests: typeof run }).runCoreTests = run;
