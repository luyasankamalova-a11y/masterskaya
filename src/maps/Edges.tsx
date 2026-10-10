// Связи на карте: мягкие кривые с лёгким индивидуальным изгибом (органично, не по линейке).
import type { Relation } from '../core/model/types';
import { relationDef } from '../core/registry/relationKinds';
import { hash01 } from './viewport';

type Pt = { x: number; y: number };

export function curve(a: Pt, b: Pt, seed: string) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const bend = (hash01(seed) - 0.5) * 0.5;
  const cx = mx - dy * bend, cy = my + dx * bend;
  // середина квадратичной кривой (t = 0.5)
  const lx = 0.25 * a.x + 0.5 * cx + 0.25 * b.x, ly = 0.25 * a.y + 0.5 * cy + 0.25 * b.y;
  return { d: `M${a.x} ${a.y}Q${cx} ${cy} ${b.x} ${b.y}`, label: { x: lx, y: ly } };
}

export function Edges({ relations, pos, draft }: {
  relations: Relation[];
  pos: (entityId: string) => Pt | undefined;
  draft?: { from: Pt; to: Pt } | null;
}) {
  return (
    <svg className="edges" width="1" height="1" aria-hidden>
      {relations.map((r) => {
        const a = pos(r.fromId), b = pos(r.toId);
        if (!a || !b) return null;
        const c = curve(a, b, r.id);
        const def = relationDef(r.kind);
        return (
          <g key={r.id} className={`edge edge--${r.kind ?? 'plain'}`}>
            <path className="edge__glow" d={c.d} />
            <path className="edge__line" d={c.d} />
            {def && r.kind !== 'part_of' && (
              <g transform={`translate(${c.label.x} ${c.label.y})`} className="edge__label">
                <circle r="13" />
                <text textAnchor="middle" dy="5">{def.icon}</text>
              </g>
            )}
          </g>
        );
      })}
      {draft && <path className="edge edge--draft" d={`M${draft.from.x} ${draft.from.y}L${draft.to.x} ${draft.to.y}`} />}
    </svg>
  );
}
