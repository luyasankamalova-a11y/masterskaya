// Демо-пример. Создаётся ТОЛЬКО в отдельной базе masterskaya-demo
// и показывает эталонный путь: идея → исследование → материал → тема Вуза → эскиз.
// Последний шаг — «Превратить в проект» — остаётся пользователю.
import { currentMode } from '../db/schema';
import { CAMPUS_ID, HOME_ID, INSPIRATION_ID, OBJECTS_ID, RESEARCH_ID } from '../registry/spaces';
import { createEntity, linkEntities, placeEntity, saveSketch, sketchFor } from './actions';
import { spaceOwnedBy } from './queries';
import { ulid } from '../ulid';

export async function seedDemo() {
  if (currentMode() !== 'demo') throw new Error('Демо-пример создаётся только в демо-режиме');

  const idea = await createEntity({ type: 'idea', title: 'Дом внутри горы', description: 'Можно ли жить внутри скалы и что для этого нужно?', spaceId: HOME_ID, at: { x: -160, y: -30 } });
  await createEntity({ type: 'question', title: 'Почему метро не затапливает?', spaceId: HOME_ID, at: { x: 230, y: -150 } });

  const research = await createEntity({ type: 'research', title: 'Можно ли построить дом внутри горы?', spaceId: RESEARCH_ID, at: { x: 0, y: 0 }, linkTo: { id: idea.id, kind: 'researching' } });
  await placeEntity(research.id, HOME_ID, 160, 110);
  const rSpace = (await spaceOwnedBy(research.id))!;
  await createEntity({ type: 'question', title: 'Геология: какая порода выдержит выемку?', spaceId: rSpace.id, at: { x: -300, y: -150 } });
  await createEntity({ type: 'question', title: 'Вода: куда уйдут грунтовые воды?', spaceId: rSpace.id, at: { x: 280, y: -170 } });
  const pdf = await createEntity({ type: 'pdf', title: 'Подземное строительство — конспект', spaceId: rSpace.id, at: { x: 60, y: 190 }, meta: { reason: 'research' } });

  const disc = await createEntity({ type: 'discipline', title: 'Механика грунтов', spaceId: CAMPUS_ID, at: { x: -80, y: -10 } });
  const dSpace = (await spaceOwnedBy(disc.id))!;
  const topic = await createEntity({ type: 'topic', title: 'Основания', spaceId: dSpace.id, at: { x: -200, y: 30 }, status: 'studying' });
  await createEntity({ type: 'topic', title: 'Давление грунта', spaceId: dSpace.id, at: { x: 170, y: -110 } });
  await createEntity({ type: 'topic', title: 'Деформации', spaceId: dSpace.id, at: { x: 150, y: 150 }, status: 'understand' });
  const due = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10);
  await createEntity({ type: 'assignment', title: 'Практическая работа №2', spaceId: dSpace.id, at: { x: -40, y: 250 }, meta: { assignmentKind: 'practical', dueDate: due } });
  await linkEntities(pdf.id, topic.id, 'studying');

  const sketch = await sketchFor(research.id, 'Разрез: жилой объём в скале', { spaceId: rSpace.id, x: -260, y: 170 });
  const layerId = 'layer:drawing';
  // Ломаная, разбитая на частые точки — как настоящий штрих пера.
  const line = (pts: [number, number][]) => {
    const dense: [number, number, number][] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 6));
      for (let k = 0; k < n; k++) dense.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, 0.55 + 0.15 * Math.sin(k / 3)]);
    }
    dense.push([...pts[pts.length - 1], 0.6]);
    return { id: ulid(), kind: 'stroke' as const, tool: 'pen' as const, color: '#e9e2d4', size: 4, layerId, points: dense };
  };
  await saveSketch({
    entityId: sketch.id, layers: [{ id: layerId, name: 'Рисунок', visible: true, locked: false }], updatedAt: Date.now(),
    elements: [
      line([[-300, 120], [-180, -60], [-60, -150], [60, -170], [190, -80], [320, 120]]),
      line([[-120, 60], [-120, -30], [80, -30], [80, 60], [-120, 60]]),
      line([[-300, 120], [320, 120]]),
    ],
  });

  await createEntity({ type: 'object', title: 'Темппелиаукио', spaceId: OBJECTS_ID, at: { x: 0, y: 0 }, meta: { place: 'Хельсинки, Финляндия', structureKind: 'Церковь в скале', why: 'Здание, вырубленное прямо в граните' } });
  await createEntity({ type: 'inspiration', title: 'Свет сквозь скальный купол', spaceId: INSPIRATION_ID, at: { x: 30, y: -20 } });
  await createEntity({ type: 'link', title: 'Статья про тоннели в скальных породах', meta: { url: 'https://example.org' } }); // быстрое сохранение → «Неразобранное»
}
