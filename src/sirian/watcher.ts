// Наблюдение Сириана за ростом идей. Это простое правило, не AI:
// если вокруг идеи выросло несколько связанных объектов, Сириан записывает
// предложение «Превратить в проект». Данные Мастерской при этом не меняются —
// предложение ждёт решения пользователя. Сам Сириан не заговаривает: виден только тихий индикатор.
import { onChange } from '../core/repo/bus';
import { growthAround, projectGrownFrom, recordProposal } from '../core/repo/actions';
import { allProposals, entitiesByType, pendingProposals } from '../core/repo/queries';
import { sirian } from './controller';

const GROWTH_THRESHOLD = 3;

export async function checkGrowth() {
  const known = new Set((await allProposals()).filter((p) => p.kind === 'to_project').map((p) => p.payload.entityId));
  for (const idea of await entitiesByType('idea')) {
    if (known.has(idea.id) || idea.aiAccess === 'blocked') continue;
    if ((await growthAround(idea.id)).length < GROWTH_THRESHOLD) continue;
    if (await projectGrownFrom(idea.id)) continue;
    await recordProposal({
      kind: 'to_project',
      payload: { entityId: idea.id },
      reason: `Похоже, маленькая идея «${idea.title}» уже стала чем-то большим: вокруг неё выросли исследование, материалы, рисунки.`,
    });
  }
  sirian.setThought((await pendingProposals()).length > 0);
}

export function startWatcher(): () => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  checkGrowth();
  return onChange((tables) => {
    if (!tables.has('relations') && !tables.has('entities') && !tables.has('proposals')) return;
    clearTimeout(t);
    t = setTimeout(checkGrowth, 600);
  });
}
