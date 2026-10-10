// Действия пользователя над Мастерской. Каждое действие собирает изменения
// и записывает их одним вызовом commit() — вместе с событиями журнала.
import type {
  Base, Entity, EntityType, ID, Placement, Proposal, Relation, RelationKind, SketchDoc, Space, SpaceKind,
} from '../model/types';
import { db } from '../db/schema';
import { ulid } from '../ulid';
import { isMaterial, typeDef } from '../registry/entityTypes';
import { PROJECTS_ID, RESEARCH_ID, STUDIO_ID } from '../registry/spaces';
import { type Change, commit, type EventInput } from './commit';
import { getEntity, getSpace, neighbourhood, placementsOf, relationsOf, spaceOwnedBy } from './queries';

const now = () => Date.now();
const base = (): Base => ({ id: ulid(), createdAt: now(), updatedAt: now(), rev: 0 });

export function makeEntity(type: EntityType, title: string, extra: Partial<Entity> = {}): Entity {
  return {
    ...base(), type, title: title.trim() || typeDef(type).label,
    meta: {}, tags: [], attachments: [], aiAccess: 'allowed', ...extra,
  };
}
export const makeRelation = (fromId: ID, toId: ID, kind?: RelationKind, origin: Relation['origin'] = 'user'): Relation =>
  ({ ...base(), fromId, toId, kind, origin });
export const makePlacement = (spaceId: ID, entityId: ID, x: number, y: number): Placement =>
  ({ ...base(), spaceId, entityId, x: Math.round(x), y: Math.round(y) });
export const makeSpace = (kind: SpaceKind, title: string, ownerEntityId?: ID): Space =>
  ({ ...base(), kind, title, ownerEntityId, viewport: { x: 0, y: 0, zoom: 1 } });

export interface CreateInput {
  type: EntityType;
  title: string;
  description?: string;
  body?: string;
  meta?: Record<string, unknown>;
  status?: string;
  attachments?: Entity['attachments'];
  /** Карта, на которую положить объект. Без неё материал попадает в «Неразобранное». */
  spaceId?: ID;
  at?: { x: number; y: number };
  /** Сразу связать с существующим объектом: новый —kind→ target. */
  linkTo?: { id: ID; kind?: RelationKind; reverse?: boolean };
}

/** Связь нового объекта с хозяином карты, на которой он создан. */
function ownerRelation(space: Space, entity: Entity): Relation | undefined {
  if (!space.ownerEntityId) return;
  if (isMaterial(entity.type) && space.kind !== 'discipline') {
    return makeRelation(space.ownerEntityId, entity.id, 'source', 'system'); // исследование —источник→ материал
  }
  return makeRelation(entity.id, space.ownerEntityId, 'part_of', 'system'); // тема —входит в→ дисциплину
}

/** Создать объект. Если у типа есть своя карта — создаётся и она (пустая). */
export async function createEntity(input: CreateInput): Promise<Entity> {
  const def = typeDef(input.type);
  const entity = makeEntity(input.type, input.title, {
    description: input.description || undefined, body: input.body || undefined,
    meta: input.meta ?? {}, attachments: input.attachments ?? [],
    status: input.status ?? def.statuses?.[0].id,
  });
  const changes: Change[] = [{ table: 'entities', put: entity }];
  const events: EventInput[] = [{ type: 'entity.created', entityId: entity.id, data: { type: entity.type, title: entity.title } }];

  if (def.ownSpace) changes.push({ table: 'spaces', put: makeSpace(def.ownSpace, entity.title, entity.id) });

  if (input.spaceId) {
    const at = input.at ?? { x: 0, y: 0 };
    changes.push({ table: 'placements', put: makePlacement(input.spaceId, entity.id, at.x, at.y) });
    const space = await getSpace(input.spaceId);
    const rel = space && space.ownerEntityId !== input.linkTo?.id ? ownerRelation(space, entity) : undefined;
    if (rel) {
      changes.push({ table: 'relations', put: rel });
      events.push({ type: 'relation.created', entityId: entity.id, relationId: rel.id, data: { kind: rel.kind } });
    }
  }
  if (input.linkTo) {
    const { id, kind, reverse } = input.linkTo;
    const rel = reverse ? makeRelation(id, entity.id, kind) : makeRelation(entity.id, id, kind);
    changes.push({ table: 'relations', put: rel });
    events.push({ type: 'relation.created', entityId: entity.id, relationId: rel.id, data: { kind } });
  }
  await commit(changes, { events });
  return entity;
}

type EntityPatch = Partial<Pick<Entity, 'title' | 'description' | 'body' | 'status' | 'tags' | 'attachments' | 'aiAccess' | 'meta'>>;

export async function updateEntity(id: ID, patch: EntityPatch) {
  const e = await getEntity(id);
  if (!e) return;
  const next: Entity = { ...e, ...patch, meta: patch.meta ? { ...e.meta, ...patch.meta } : e.meta };
  const changes: Change[] = [{ table: 'entities', put: next }];
  const events: EventInput[] = [];
  if (patch.status !== undefined && patch.status !== e.status) {
    events.push({ type: 'status.changed', entityId: id, data: { from: e.status, to: patch.status, entityType: e.type } });
  } else {
    events.push({ type: 'entity.updated', entityId: id, data: { fields: Object.keys(patch) } });
  }
  if (patch.title && patch.title !== e.title) {
    const sp = await spaceOwnedBy(id);
    if (sp) changes.push({ table: 'spaces', put: { ...sp, title: patch.title } });
  }
  await commit(changes, { events });
}

/** Связать два объекта. Повторная связь той же пары не создаётся. */
export async function linkEntities(fromId: ID, toId: ID, kind?: RelationKind, origin: Relation['origin'] = 'user'): Promise<Relation | undefined> {
  if (fromId === toId) return;
  const existing = (await relationsOf(fromId)).find((r) =>
    (r.fromId === fromId && r.toId === toId) || (r.fromId === toId && r.toId === fromId));
  if (existing) return existing;
  const rel = makeRelation(fromId, toId, kind, origin);
  await commit([{ table: 'relations', put: rel }], {
    events: [{ type: 'relation.created', entityId: fromId, relationId: rel.id, data: { toId, kind, origin } }],
  });
  return rel;
}

export async function setRelationKind(rel: Relation, kind?: RelationKind) {
  await commit([{ table: 'relations', put: { ...rel, kind } }], {
    events: [{ type: 'entity.updated', entityId: rel.fromId, relationId: rel.id, data: { relationKind: kind ?? null } }],
  });
}

export async function unlink(rel: Relation) {
  await commit([{ table: 'relations', put: { ...rel, deletedAt: now() } }], {
    events: [{ type: 'relation.deleted', entityId: rel.fromId, relationId: rel.id }],
  });
}

/** Позиция сохраняется в конце перетаскивания, а не на каждом движении. */
export async function moveNode(p: Placement, x: number, y: number) {
  await commit([{ table: 'placements', put: { ...p, x: Math.round(x), y: Math.round(y) } }]);
}

/** Поставить существующий объект на карту (ещё одна позиция того же объекта, не копия). */
export async function placeEntity(entityId: ID, spaceId: ID, x: number, y: number): Promise<Placement> {
  const existing = (await placementsOf(entityId)).find((p) => p.spaceId === spaceId);
  if (existing) return existing;
  const p = makePlacement(spaceId, entityId, x, y);
  await commit([{ table: 'placements', put: p }]);
  return p;
}

/** Убрать с этой карты: объект и его связи остаются. */
export async function removeFromMap(p: Placement) {
  await commit([{ table: 'placements', put: { ...p, deletedAt: now() } }]);
}

export async function archiveEntity(id: ID) {
  const e = await getEntity(id);
  if (e) await commit([{ table: 'entities', put: { ...e, archivedAt: now() } }], { events: [{ type: 'entity.archived', entityId: id }] });
}

export async function restoreEntity(id: ID) {
  const e = await getEntity(id);
  if (!e) return;
  const rest = { ...e };
  delete rest.archivedAt;
  await commit([{ table: 'entities', put: rest }], { events: [{ type: 'entity.restored', entityId: id }] });
}

/**
 * Удалить объект. Каскадом уходят: его связи и позиции на всех картах,
 * его собственная карта (объекты на ней остаются в Мастерской), эскиз, файлы и их фрагменты.
 */
export async function deleteEntity(id: ID) {
  const e = await getEntity(id);
  if (!e) return;
  const t = now();
  const changes: Change[] = [{ table: 'entities', put: { ...e, deletedAt: t } }];
  for (const r of await relationsOf(id)) changes.push({ table: 'relations', put: { ...r, deletedAt: t } });
  for (const p of await placementsOf(id)) changes.push({ table: 'placements', put: { ...p, deletedAt: t } });
  const own = await spaceOwnedBy(id);
  if (own) {
    changes.push({ table: 'spaces', put: { ...own, deletedAt: t } });
    for (const p of await db.placements.where('spaceId').equals(own.id).toArray()) {
      if (!p.deletedAt) changes.push({ table: 'placements', put: { ...p, deletedAt: t } });
    }
  }
  for (const a of e.attachments) {
    changes.push({ table: 'files', remove: a.fileId });
    for (const c of await db.fileChunks.where('fileId').equals(a.fileId).toArray()) changes.push({ table: 'fileChunks', remove: c.id });
  }
  if (await db.sketches.get(id)) changes.push({ table: 'sketches', remove: id });
  for (const pr of await db.proposals.where('status').equals('pending').toArray()) {
    if (pr.payload.entityId === id) changes.push({ table: 'proposals', remove: pr.id });
  }
  await commit(changes, { events: [{ type: 'entity.deleted', entityId: id, data: { type: e.type, title: e.title } }] });
}

/** Начать исследование от объекта: новый Research —исследую→ объект. */
export async function researchFrom(entityId: ID, title: string, near?: { spaceId: ID; x: number; y: number }): Promise<Entity> {
  const r = await createEntity({ type: 'research', title, spaceId: RESEARCH_ID, at: await freeSpot(RESEARCH_ID), linkTo: { id: entityId, kind: 'researching' } });
  if (near && near.spaceId !== RESEARCH_ID) await placeEntity(r.id, near.spaceId, near.x, near.y);
  return r;
}

/** Нарисовать для объекта: новый эскиз —нарисовала→ объект, лежит в Студии. */
export async function sketchFor(entityId: ID | undefined, title: string, near?: { spaceId: ID; x: number; y: number }): Promise<Entity> {
  const s = await createEntity({
    type: 'sketch', title, spaceId: STUDIO_ID, at: await freeSpot(STUDIO_ID),
    linkTo: entityId ? { id: entityId, kind: 'drew' } : undefined,
  });
  if (near && near.spaceId !== STUDIO_ID) await placeEntity(s.id, near.spaceId, near.x, near.y);
  return s;
}

/**
 * Свободное место на карте: ближайшая к точке позиция, где новый узел
 * не ляжет поверх существующих (поиск по спирали).
 */
export async function freeSpot(spaceId: ID, near: { x: number; y: number } = { x: 0, y: 0 }): Promise<{ x: number; y: number }> {
  const ps = (await db.placements.where('spaceId').equals(spaceId).toArray()).filter((p) => !p.deletedAt);
  for (let i = 0; i < 600; i++) {
    const a = i * 2.39996;
    const r = i === 0 ? 0 : 40 * Math.sqrt(i) * 2.2;
    const x = near.x + Math.cos(a) * r * 1.3, y = near.y + Math.sin(a) * r * 0.75;
    if (ps.every((p) => Math.abs(p.x - x) > 250 || Math.abs(p.y - y) > 120)) return { x: Math.round(x), y: Math.round(y) };
  }
  return { x: near.x + ps.length * 30, y: near.y };
}

/** Что выросло вокруг идеи: объекты в окрестности 2 шага (без дисциплин и уже выросших проектов). */
export async function growthAround(ideaId: ID): Promise<Entity[]> {
  return (await neighbourhood(ideaId, 2)).filter((e) => e.type !== 'discipline' && e.type !== 'project');
}

/** Проект, уже выросший из идеи (если есть). */
export async function projectGrownFrom(ideaId: ID): Promise<Entity | undefined> {
  const rels = (await relationsOf(ideaId)).filter((r) => r.kind === 'grew_from' && r.toId === ideaId);
  for (const r of rels) {
    const p = await getEntity(r.fromId);
    if (p) return p;
  }
}

/**
 * «Превратить в проект». Идея НЕ исчезает и не меняет тип.
 * - создаётся новый Project и его карта;
 * - связь Project —вырос из→ Idea;
 * - на карту проекта ставятся позиции (не копии) идеи и выбранных выросших объектов;
 * - исходные связи между ними не трогаются;
 * - каждый выбранный объект дополнительно связывается с проектом (—входит в→ Project),
 *   чтобы проект был связан с содержимым не только визуально.
 */
export async function growIntoProject(ideaId: ID, opts: { title?: string; includeIds: ID[] }): Promise<Entity | undefined> {
  const idea = await getEntity(ideaId);
  if (!idea) return;
  const project = makeEntity('project', opts.title ?? idea.title, { description: idea.description });
  const space = makeSpace('project', project.title, project.id);
  const grew = makeRelation(project.id, idea.id, 'grew_from', 'user');
  const included = (await Promise.all(opts.includeIds.filter((id) => id !== ideaId).map((id) => getEntity(id))))
    .filter((e): e is Entity => !!e);

  const changes: Change[] = [
    { table: 'entities', put: project },
    { table: 'spaces', put: space },
    { table: 'relations', put: grew },
    { table: 'placements', put: makePlacement(space.id, idea.id, 0, 0) },
  ];
  const events: EventInput[] = [
    { type: 'entity.created', entityId: project.id, data: { type: 'project', title: project.title } },
    { type: 'project.grown', entityId: project.id, relationId: grew.id, data: { fromIdea: idea.id, ideaTitle: idea.title, included: included.map((e) => e.id) } },
  ];
  included.forEach((e, i) => {
    const a = (i / Math.max(included.length, 1)) * Math.PI * 2 - Math.PI / 2 + 0.35;
    const r = 260 + (i % 2) * 60;
    changes.push({ table: 'placements', put: makePlacement(space.id, e.id, Math.cos(a) * r * 1.2, Math.sin(a) * r * 0.75) });
    const rel = makeRelation(e.id, project.id, 'part_of', 'system');
    changes.push({ table: 'relations', put: rel });
    events.push({ type: 'relation.created', entityId: e.id, relationId: rel.id, data: { kind: 'part_of', toId: project.id } });
  });
  const spot = await freeSpot(PROJECTS_ID);
  changes.push({ table: 'placements', put: makePlacement(PROJECTS_ID, project.id, spot.x, spot.y) });

  for (const pr of await db.proposals.where('status').equals('pending').toArray()) {
    if (pr.kind === 'to_project' && pr.payload.entityId === ideaId) changes.push({ table: 'proposals', put: { ...pr, status: 'accepted' } });
  }
  await commit(changes, { events });
  return project;
}

/** Предложение Сириана записывается, но данные Мастерской не меняет. */
export async function recordProposal(p: Omit<Proposal, 'id' | 'createdAt' | 'status'>): Promise<Proposal> {
  const pr: Proposal = { ...p, id: ulid(), createdAt: now(), status: 'pending' };
  await commit([{ table: 'proposals', put: pr }], { local: true });
  return pr;
}

export async function resolveProposal(id: ID, status: 'accepted' | 'rejected') {
  const pr = await db.proposals.get(id);
  if (pr) await commit([{ table: 'proposals', put: { ...pr, status } }], { local: true });
}

export async function saveViewport(spaceId: ID, viewport: Space['viewport']) {
  const sp = await db.spaces.get(spaceId);
  if (sp) await commit([{ table: 'spaces', put: { ...sp, viewport } }], { local: true });
}

/** Сохранить эскиз как редактируемую структуру (не картинку). Значимые версии — этап 2. */
export async function saveSketch(doc: SketchDoc) {
  const e = await getEntity(doc.entityId);
  const changes: Change[] = [{ table: 'sketches', put: { ...doc, updatedAt: now() } }];
  if (e) changes.push({ table: 'entities', put: e }); // обновляет updatedAt эскиза для «Недавнего»
  await commit(changes);
}
