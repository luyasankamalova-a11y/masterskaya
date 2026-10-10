// Узел карты. Внешний вид зависит от типа объекта: крупные «плиты» для пространств
// (дисциплина, исследование, проект), «семена» для идей, карточки для материалов,
// превью для эскизов и фото. Узлы разного размера — карта не выглядит как сетка.
import { type CSSProperties, memo } from 'react';
import type { Entity, SketchDoc } from '../core/model/types';
import { typeDef } from '../core/registry/entityTypes';
import { dueLabel, statusOf, useImageUrl } from '../shell/format';
import { SketchPreview } from '../studio/SketchPreview';

interface Props {
  entity: Entity;
  selected: boolean;
  target: boolean;
  outside: number;
  sketch?: SketchDoc;
}

const SHAPE: Partial<Record<Entity['type'], string>> = {
  discipline: 'plate', research: 'plate', project: 'plate',
  idea: 'seed', question: 'seed',
  sketch: 'frame', photo: 'frame', inspiration: 'frame',
};

export const NodeCard = memo(function NodeCard({ entity, selected, target, outside, sketch }: Props) {
  const def = typeDef(entity.type);
  const shape = SHAPE[entity.type] ?? 'card';
  const status = statusOf(entity);
  const due = entity.type === 'assignment' ? dueLabel(entity.meta.dueDate) : null;
  const img = useImageUrl(entity);
  const place = entity.type === 'object' && typeof entity.meta.place === 'string' ? entity.meta.place : null;
  return (
    <div
      className={`node node--${shape} node-type--${entity.type}${selected ? ' is-selected' : ''}${target ? ' is-target' : ''}`}
      style={status ? ({ '--status': status.color } as CSSProperties) : undefined}
    >
      {shape === 'frame' && (
        <div className="node__visual">
          {entity.type === 'sketch' ? <SketchPreview doc={sketch} /> : img ? <img src={img} alt="" draggable={false} /> : <span className="node__glyph">{def.icon}</span>}
        </div>
      )}
      <div className="node__body">
        {shape !== 'frame' && <span className="node__icon" aria-hidden>{def.icon}</span>}
        <span className="node__title">{entity.title}</span>
      </div>
      {(status || due || place) && (
        <div className="node__meta">
          {status && <span className="node__status"><i />{status.label}</span>}
          {due && <span className="node__due">📅 {due}</span>}
          {place && <span>{place}</span>}
        </div>
      )}
      {outside > 0 && <span className="node__outside" title="Связи с объектами на других картах">↗ {outside}</span>}
      {entity.aiAccess === 'blocked' && <span className="node__lock" title="Не использовать AI">🔒</span>}
      <span className="node__handle" data-handle aria-label="Протянуть связь" />
    </div>
  );
});
