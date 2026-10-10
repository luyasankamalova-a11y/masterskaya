// Чтение данных. Удалённые (deletedAt) записи никогда не возвращаются;
// архивные — только по явному запросу.
import type { AppEvent, Entity, EntityType, ID, Placement, Proposal, Relation, SketchDoc, Space } from '../model/types';
import { db } from '../db/schema';
import { isMaterial } from '../registry/entityTypes';

const alive = <T extends { deletedAt?: number }>(x: T | undefined): x is T => !!x && !x.deletedAt;
const visible = (e: Entity | undefined): e is Entity => alive(e) && !e.archivedAt;

export async function getEntity(id: ID, includeArchived = true): Promise<Entity | undefined> {
  const e = await db.entities.get(id);
  return (includeArchived ? alive(e) : visible(e)) ? e : undefined;
}

export async function getSpace(id: ID): Promise<Space | undefined> {
  const s = await db.spaces.get(id);
  return alive(s) ? s : undefined;
}

export async function allEntities(includeArchived = false): Promise<Entity[]> {
  return (await db.entities.toArray()).filter(includeArchived ? alive : visible);
}

export async function entitiesByType(type: EntityType): Promise<Entity[]> {
  return (await db.entities.where('type').equals(type).toArray()).filter(visible);
}

/** Собственная карта объекта (дисциплины, исследования, проекта). */
export async function spaceOwnedBy(entityId: ID): Promise<Space | undefined> {
  return (await db.spaces.where('ownerEntityId').equals(entityId).toArray()).find((s) => alive(s));
}

export interface MapNode { placement: Placement; entity: Entity }

/** Узлы карты: позиции + их объекты (без удалённых и архивных). */
export async function nodesInSpace(spaceId: ID): Promise<MapNode[]> {
  const placements = (await db.placements.where('spaceId').equals(spaceId).toArray()).filter(alive);
  const entities = await db.entities.bulkGet(placements.map((p) => p.entityId));
  const nodes: MapNode[] = [];
  placements.forEach((p, i) => {
    const e = entities[i];
    if (visible(e)) nodes.push({ placement: p, entity: e });
  });
  return nodes;
}

export async function relationsOf(entityId: ID): Promise<Relation[]> {
  const [a, b] = await Promise.all([
    db.relations.where('fromId').equals(entityId).toArray(),
    db.relations.where('toId').equals(entityId).toArray(),
  ]);
  return [...a, ...b].filter(alive);
}

/** Связи между объектами набора — для отрисовки на карте. Плюс число связей «наружу». */
export async function relationsForMap(ids: ID[]): Promise<{ inside: Relation[]; outside: Record<ID, number> }> {
  const set = new Set(ids);
  const [a, b] = await Promise.all([
    db.relations.where('fromId').anyOf(ids).toArray(),
    db.relations.where('toId').anyOf(ids).toArray(),
  ]);
  const seen = new Map<ID, Relation>();
  [...a, ...b].filter(alive).forEach((r) => seen.set(r.id, r));
  const inside: Relation[] = [];
  const outside: Record<ID, number> = {};
  for (const r of seen.values()) {
    if (set.has(r.fromId) && set.has(r.toId)) inside.push(r);
    else {
      if (set.has(r.fromId)) outside[r.fromId] = (outside[r.fromId] ?? 0) + 1;
      if (set.has(r.toId)) outside[r.toId] = (outside[r.toId] ?? 0) + 1;
    }
  }
  return { inside, outside };
}

export interface Neighbour { relation: Relation; entity: Entity; direction: 'out' | 'in' }

export async function neighbours(entityId: ID, includeArchived = true): Promise<Neighbour[]> {
  const rels = await relationsOf(entityId);
  const others = await db.entities.bulkGet(rels.map((r) => (r.fromId === entityId ? r.toId : r.fromId)));
  const out: Neighbour[] = [];
  rels.forEach((r, i) => {
    const e = others[i];
    if (includeArchived ? alive(e) : visible(e)) out.push({ relation: r, entity: e!, direction: r.fromId === entityId ? 'out' : 'in' });
  });
  return out;
}

/**
 * Окрестность объекта на N шагов по связям (для «идея растёт» и карты нового проекта).
 * Связи «входит в» (part_of) не ведут дальше: тема дисциплины не тянет за собой всю дисциплину.
 */
export async function neighbourhood(entityId: ID, hops = 2): Promise<Entity[]> {
  const found = new Map<ID, Entity>();
  const visited = new Set([entityId]);
  let frontier = [entityId];
  for (let h = 0; h < hops; h++) {
    const next: ID[] = [];
    for (const id of frontier) {
      for (const n of await neighbours(id, false)) {
        if (n.relation.kind === 'part_of' || visited.has(n.entity.id)) continue;
        visited.add(n.entity.id);
        found.set(n.entity.id, n.entity);
        next.push(n.entity.id);
      }
    }
    frontier = next;
  }
  return [...found.values()];
}

export async function placementsOf(entityId: ID): Promise<Placement[]> {
  return (await db.placements.where('entityId').equals(entityId).toArray()).filter(alive);
}

/** Где объект лежит: карты, на которых у него есть позиция. */
export async function whereIs(entityId: ID): Promise<{ placement: Placement; space: Space }[]> {
  const ps = await placementsOf(entityId);
  const spaces = await db.spaces.bulkGet(ps.map((p) => p.spaceId));
  return ps.map((p, i) => ({ placement: p, space: spaces[i]! })).filter((x) => alive(x.space));
}

/**
 * Лоток «Неразобранное»: материалы, у которых нет места ни на одной карте
 * (быстрые сохранения). Материал, добавленный внутри исследования или дисциплины,
 * уже размещён там и сюда не попадает.
 */
export async function unsortedMaterials(): Promise<Entity[]> {
  const placed = new Set((await db.placements.toArray()).filter(alive).map((p) => p.entityId));
  return (await allEntities()).filter((e) => isMaterial(e.type) && !placed.has(e.id)).sort((a, b) => b.createdAt - a.createdAt);
}

/** Материалы, размещённые в других пространствах, но ещё не на карте Библиотеки. */
export async function materialsElsewhere(librarySpaceId: ID): Promise<Entity[]> {
  const ps = (await db.placements.toArray()).filter(alive);
  const inLibrary = new Set(ps.filter((p) => p.spaceId === librarySpaceId).map((p) => p.entityId));
  const elsewhere = new Set(ps.filter((p) => p.spaceId !== librarySpaceId).map((p) => p.entityId));
  return (await allEntities()).filter((e) => isMaterial(e.type) && elsewhere.has(e.id) && !inLibrary.has(e.id));
}

export async function recentEntities(limit = 10): Promise<Entity[]> {
  return (await allEntities()).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
}

export async function archivedEntities(): Promise<Entity[]> {
  return (await allEntities(true)).filter((e) => e.archivedAt);
}

export async function recentEvents(limit = 200): Promise<AppEvent[]> {
  return (await db.events.toArray()).sort((a, b) => b.at - a.at).slice(0, limit);
}

export async function pendingProposals(): Promise<Proposal[]> {
  return (await db.proposals.where('status').equals('pending').toArray()).sort((a, b) => b.createdAt - a.createdAt);
}

export async function allProposals(): Promise<Proposal[]> {
  return db.proposals.toArray();
}

export async function getSketch(entityId: ID): Promise<SketchDoc | undefined> {
  return db.sketches.get(entityId);
}

/** Количество позиций на каждой карте — для «созвездий» на карте мира. */
export async function placementCounts(): Promise<Record<ID, number>> {
  const out: Record<ID, number> = {};
  const ps = (await db.placements.toArray()).filter(alive);
  const ents = await db.entities.bulkGet(ps.map((p) => p.entityId));
  ps.forEach((p, i) => { if (visible(ents[i])) out[p.spaceId] = (out[p.spaceId] ?? 0) + 1; });
  return out;
}
