import type { SketchDoc } from '../core/model/types';
import { strokePath, strokesBounds } from './strokeGeometry';

/** Миниатюра эскиза для узла карты — рисуется из той же структуры штрихов. */
export function SketchPreview({ doc }: { doc?: SketchDoc }) {
  const b = doc && strokesBounds(doc.elements);
  if (!doc || !b) return <span className="node__glyph">✏️</span>;
  const pad = 20;
  const w = Math.max(b.maxX - b.minX, 40) + pad * 2, h = Math.max(b.maxY - b.minY, 40) + pad * 2;
  return (
    <svg viewBox={`${b.minX - pad} ${b.minY - pad} ${w} ${h}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      {doc.elements.map((s) => <path key={s.id} d={strokePath(s)} fill={s.color} opacity={s.tool === 'pencil' ? 0.75 : 1} />)}
    </svg>
  );
}
