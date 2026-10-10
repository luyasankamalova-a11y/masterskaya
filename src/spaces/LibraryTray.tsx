// Лотки Библиотеки. Это НЕ замена карте, а временные места рядом с ней:
//  • «Неразобранное» — быстрые сохранения без места ни на одной карте;
//  • «Лежит в других пространствах» — материалы из исследований, дисциплин и проектов,
//    которых ещё нет на карте Библиотеки.
// Нажатие ставит материал на карту Библиотеки — это новая позиция того же объекта, не копия.
import { useState } from 'react';
import type { Entity } from '../core/model/types';
import { freeSpot, placeEntity } from '../core/repo/actions';
import { materialsElsewhere, unsortedMaterials } from '../core/repo/queries';
import { LIBRARY_ID } from '../core/registry/spaces';
import { viewCenter } from '../maps/center';
import { useLive } from '../store/useLive';
import { icon } from '../shell/format';
import { useUI } from '../store/ui';

export function LibraryTray() {
  const unsorted = useLive(unsortedMaterials, [], ['entities', 'placements']) ?? [];
  const elsewhere = useLive(() => materialsElsewhere(LIBRARY_ID), [], ['entities', 'placements']) ?? [];
  const [open, setOpen] = useState(true);
  if (!unsorted.length && !elsewhere.length) return null;

  const place = async (e: Entity) => {
    const at = await freeSpot(LIBRARY_ID, viewCenter(LIBRARY_ID));
    await placeEntity(e.id, LIBRARY_ID, at.x, at.y);
  };

  return (
    <aside className={`tray${open ? '' : ' is-collapsed'}`} aria-label="Лотки Библиотеки">
      <button className="tray__toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? 'Свернуть' : `Неразобранное · ${unsorted.length}`}
      </button>
      {open && (
        <>
          <section data-testid="unsorted">
            <h3>Неразобранное</h3>
            {unsorted.length ? <p className="tray__hint">Быстрые сохранения без места. Нажми — и материал встанет на карту.</p> : <p className="tray__hint">Пусто: всё разложено.</p>}
            <ul>{unsorted.map((e) => <TrayItem key={e.id} e={e} onPlace={place} />)}</ul>
          </section>
          {elsewhere.length > 0 && (
            <section data-testid="elsewhere">
              <h3>Лежит в других пространствах</h3>
              <ul>{elsewhere.map((e) => <TrayItem key={e.id} e={e} onPlace={place} />)}</ul>
            </section>
          )}
        </>
      )}
    </aside>
  );
}

function TrayItem({ e, onPlace }: { e: Entity; onPlace: (e: Entity) => void }) {
  return (
    <li>
      <button className="tray__item" onClick={() => onPlace(e)} title="Поставить на карту Библиотеки">
        <span aria-hidden>{icon(e)}</span><span>{e.title}</span><span className="tray__put">на карту</span>
      </button>
      <button className="tray__open" aria-label={`Открыть «${e.title}»`} onClick={() => useUI.getState().showPanel(e.id)}>⋯</button>
    </li>
  );
}
