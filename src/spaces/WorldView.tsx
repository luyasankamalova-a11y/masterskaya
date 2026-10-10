// Карта мира — вход в Мастерскую. Девять областей на ночном инженерном плане.
// Вокруг каждой области — «созвездие»: по огоньку на каждый объект на её карте
// (не число и не показатель, просто видно, где мир растёт).
import { useEffect, useState } from 'react';
import { placementCounts } from '../core/repo/queries';
import { AREAS, type AreaDef } from '../core/registry/spaces';
import { go } from '../app/router';
import { useLive } from '../store/useLive';
import { hash01 } from '../maps/viewport';
import { sirian } from '../sirian/controller';

export function WorldView() {
  const counts = useLive(placementCounts, [], ['placements', 'entities']) ?? {};
  const [leaving, setLeaving] = useState<AreaDef | null>(null);
  useEffect(() => { sirian.setContext('world'); }, []);

  function enter(a: AreaDef) {
    if (leaving) return;
    setLeaving(a);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => go({ name: 'space', id: a.id }), reduce ? 0 : 380);
  }

  return (
    <div
      className={`world${leaving ? ' is-zooming' : ''}`}
      style={leaving ? { transformOrigin: `${leaving.at.x * 100}% ${leaving.at.y * 100}%` } : undefined}
    >
      <svg className="world__survey" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {AREAS.filter((a) => a.kind !== 'home').map((a) => (
          <line key={a.id} x1={50} y1={50} x2={a.at.x * 100} y2={a.at.y * 100} />
        ))}
      </svg>
      <h1 className="world__title">Моя Мастерская</h1>
      {AREAS.map((a) => (
        <button
          key={a.id}
          className={`area area--${a.kind}`}
          style={{ left: `clamp(76px, ${a.at.x * 100}%, calc(100% - 92px))`, top: `clamp(120px, ${a.at.y * 100}%, calc(100% - 110px))` }}
          onClick={() => enter(a)}
          data-testid={`area-${a.kind}`}
        >
          <Constellation id={a.id} count={counts[a.id] ?? 0} />
          <span className="area__icon" aria-hidden>{a.icon}</span>
          <span className="area__title">{a.title}</span>
          <span className="area__hint">{a.hint}</span>
        </button>
      ))}
    </div>
  );
}

function Constellation({ id, count }: { id: string; count: number }) {
  const n = Math.min(count, 18);
  return (
    <span className="area__stars" aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const a = hash01(id + i) * Math.PI * 2;
        const r = 58 + hash01(i + id) * 34;
        return <i key={i} style={{ transform: `translate(${Math.cos(a) * r * 1.3}px, ${Math.sin(a) * r * 0.8}px)` }} />;
      })}
    </span>
  );
}
