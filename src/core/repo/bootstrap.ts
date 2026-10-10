// Первый запуск: создаются только пустые системные пространства (мир и его области).
// Никаких заранее созданных дисциплин, проектов, объектов — пустой старт.
import type { Space } from '../model/types';
import { db } from '../db/schema';
import { AREAS, WORLD_ID } from '../registry/spaces';
import { commit } from './commit';

export async function bootstrap(): Promise<void> {
  const existing = new Set((await db.spaces.toArray()).map((s) => s.id));
  const t = Date.now();
  const make = (id: string, kind: Space['kind'], title: string): Space =>
    ({ id, kind, title, viewport: { x: 0, y: 0, zoom: 1 }, createdAt: t, updatedAt: t, rev: 0 });
  const missing: Space[] = [];
  if (!existing.has(WORLD_ID)) missing.push(make(WORLD_ID, 'world', 'Мой мир'));
  for (const a of AREAS) if (!existing.has(a.id)) missing.push(make(a.id, a.kind, a.title));
  if (missing.length) await commit(missing.map((s) => ({ table: 'spaces' as const, put: s })), { local: true });
}
