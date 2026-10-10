// Пространство: любая карта Мастерской (Главная, Вуз, дисциплина, исследование,
// Библиотека, Проекты, проект, Вдохновение, Студия, Объекты).
// Один и тот же движок карт; различаются тема, подсказки и боковые лотки.
import { useEffect } from 'react';
import type { Entity, ID, SketchDoc, Space } from '../core/model/types';
import { db } from '../core/db/schema';
import { linkEntities, moveNode } from '../core/repo/actions';
import { getEntity, getSpace, neighbours, nodesInSpace, relationsForMap } from '../core/repo/queries';
import { typeDef } from '../core/registry/entityTypes';
import { areaById, LIBRARY_ID, SPACE_THEME } from '../core/registry/spaces';
import { MapView } from '../maps/MapView';
import { openEntity } from '../app/navigation';
import { useLive } from '../store/useLive';
import { toast, useUI } from '../store/ui';
import { sirian } from '../sirian/controller';
import { LibraryTray } from './LibraryTray';
import { EmptyHint } from './EmptyHint';

const MAP_TABLES = ['placements', 'entities', 'relations', 'sketches', 'spaces'];

export function SpaceView({ spaceId }: { spaceId: ID }) {
  const data = useLive(async () => {
    const space = await getSpace(spaceId);
    if (!space) return null;
    const owner = space.ownerEntityId ? await getEntity(space.ownerEntityId) : undefined;
    const nodes = await nodesInSpace(spaceId);
    const ids = nodes.map((n) => n.entity.id);
    const { inside, outside } = await relationsForMap(ids);
    const sketchIds = nodes.filter((n) => n.entity.type === 'sketch').map((n) => n.entity.id);
    const sketches: Record<ID, SketchDoc> = {};
    (await db.sketches.bulkGet(sketchIds)).forEach((s) => { if (s) sketches[s.entityId] = s; });
    const origin = owner?.type === 'project'
      ? (await neighbours(owner.id)).find((n) => n.relation.kind === 'grew_from' && n.direction === 'out')?.entity
      : undefined;
    return { space, owner, nodes, inside, outside, sketches, origin };
  }, [spaceId], MAP_TABLES);

  const connectFrom = useUI((s) => s.connectFrom);
  useEffect(() => { if (data?.space) sirian.setContext(data.space.kind); }, [data?.space.kind]);

  if (data === undefined) return <div className="map map--loading" />;
  if (data === null) return <div className="screen-message">Этой карты больше нет. Вернись в мир.</div>;

  const { space, owner, nodes, inside, outside, sketches, origin } = data;
  const area = areaById(space.id);

  async function connect(fromId: ID, toId: ID) {
    const rel = await linkEntities(fromId, toId);
    if (rel) useUI.setState({ justLinked: rel, connectFrom: null });
  }

  async function pickTarget(e: Entity) {
    const from = useUI.getState().connectFrom;
    if (from && from !== e.id) await connect(from, e.id);
    else useUI.setState({ connectFrom: null });
  }

  return (
    <div className="space">
      <MapView
        key={space.id}
        spaceId={space.id}
        theme={SPACE_THEME[space.kind]}
        nodes={nodes}
        relations={inside}
        outside={outside}
        sketches={sketches}
        initialViewport={space.viewport}
        connectFrom={connectFrom}
        onOpen={openEntity}
        onMenu={(n, x, y) => useUI.setState({ menu: { entityId: n.entity.id, placementId: n.placement.id, spaceId: space.id, x, y } })}
        onConnect={connect}
        onPickTarget={pickTarget}
        onAddAt={(at) => useUI.getState().open({ kind: 'add', spaceId: space.id, at })}
        onMove={(pl, x, y) => moveNode(pl, x, y).catch(() => toast('Не удалось сохранить положение'))}
        emptyHint={<EmptyHint space={space} owner={owner} />}
      />
      {area?.note && <div className="space__note">{area.note}</div>}
      {origin && (
        <button className="space__origin" data-testid="origin" onClick={() => useUI.getState().showPanel(origin.id)}>
          🌱 вырос из идеи «{origin.title}»
        </button>
      )}
      {space.id === LIBRARY_ID && <LibraryTray />}
      {connectFrom && <ConnectBanner fromId={connectFrom} />}
    </div>
  );
}

function ConnectBanner({ fromId }: { fromId: ID }) {
  const e = useLive(() => getEntity(fromId), [fromId], ['entities']);
  return (
    <div className="connect-banner" role="status">
      <span>Связать «{e?.title}» — нажми на второй объект на карте</span>
      <button onClick={() => useUI.getState().open({ kind: 'link', fromId })}>Найти в другом месте</button>
      <button onClick={() => useUI.setState({ connectFrom: null })}>Отмена</button>
    </div>
  );
}

export function spaceTitle(space: Space, owner?: Entity) {
  if (owner) return { icon: typeDef(owner.type).icon, title: owner.title, kind: typeDef(owner.type).label };
  const a = areaById(space.id);
  return { icon: a?.icon ?? '◦', title: a?.title ?? space.title, kind: a?.hint ?? '' };
}
