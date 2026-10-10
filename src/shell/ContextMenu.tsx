// Контекстное меню узла (долгое нажатие / правая кнопка).
import { useEffect } from 'react';
import { researchFrom, removeFromMap, archiveEntity, deleteEntity, sketchFor } from '../core/repo/actions';
import { getEntity, spaceOwnedBy } from '../core/repo/queries';
import { typeDef } from '../core/registry/entityTypes';
import { openEntity } from '../app/navigation';
import { go } from '../app/router';
import { useLive } from '../store/useLive';
import { toast, useUI, type ContextMenuState } from '../store/ui';
import { confirmAction } from './confirm';
import { db } from '../core/db/schema';

const RESEARCHABLE = new Set(['idea', 'question', 'object', 'topic', 'inspiration', 'photo', 'note']);
const DRAWABLE = new Set(['idea', 'question', 'object', 'topic', 'research', 'project', 'assignment', 'photo', 'inspiration']);

export function ContextMenu({ menu }: { menu: ContextMenuState }) {
  const e = useLive(() => getEntity(menu.entityId), [menu.entityId], ['entities']);
  const close = () => useUI.setState({ menu: null });
  useEffect(() => {
    const k = (ev: KeyboardEvent) => { if (ev.key === 'Escape') close(); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  if (!e) return null;
  const def = typeDef(e.type);
  const near = async () => {
    const p = menu.placementId ? await db.placements.get(menu.placementId) : undefined;
    return p && menu.spaceId ? { spaceId: menu.spaceId, x: p.x + 230, y: p.y + 40 } : undefined;
  };

  const items: { label: string; run: () => unknown; danger?: boolean; testid?: string }[] = [
    { label: def.ownSpace ? 'Открыть карту' : e.type === 'sketch' ? 'Открыть в Студии' : 'Открыть', run: () => openEntity(e) },
    { label: 'Карточка', run: () => useUI.getState().showPanel(e.id) },
    { label: '🔗 Связать…', run: () => useUI.setState({ connectFrom: e.id }), testid: 'menu-link' },
  ];
  if (RESEARCHABLE.has(e.type)) items.push({
    label: '🔎 Исследовать', run: async () => {
      const r = await researchFrom(e.id, e.type === 'question' ? e.title : `Исследование: ${e.title}`, await near());
      toast(`Начато исследование «${r.title}»`);
    },
  });
  if (DRAWABLE.has(e.type)) items.push({
    label: '✏️ Нарисовать', run: async () => {
      const s = await sketchFor(e.id, `Эскиз: ${e.title}`, await near());
      go({ name: 'sketch', id: s.id });
    },
  });
  if (e.type === 'idea') items.push({ label: '🏗️ Превратить в проект', run: () => useUI.getState().open({ kind: 'grow', ideaId: e.id }), testid: 'menu-grow' });
  if (menu.placementId) items.push({
    label: 'Убрать с этой карты', run: async () => {
      const p = await db.placements.get(menu.placementId!);
      const own = await spaceOwnedBy(e.id);
      if (p) await removeFromMap(p);
      toast(own || (await db.placements.where('entityId').equals(e.id).toArray()).some((x) => !x.deletedAt)
        ? 'Убрано с карты. Объект и связи остались.' : 'Убрано с карты. Объект остался в Мастерской — найдёшь через поиск.');
    },
  });
  items.push({ label: 'В архив', run: async () => { await archiveEntity(e.id); toast('Объект в архиве'); } });
  items.push({
    label: 'Удалить…', danger: true, testid: 'menu-delete', run: async () => {
      if (await confirmAction(`Удалить «${e.title}»? Уйдут его связи и места на всех картах.`)) { await deleteEntity(e.id); toast('Удалено'); }
    },
  });

  const x = Math.min(menu.x, innerWidth - 250), y = Math.min(menu.y, innerHeight - items.length * 46 - 20);
  return (
    <div className="scrim scrim--clear" onPointerDown={(ev) => { if (ev.target === ev.currentTarget) close(); }}>
      <nav className="menu" style={{ left: Math.max(8, x), top: Math.max(8, y) }} aria-label={`Действия: ${e.title}`}>
        <div className="menu__title">{def.icon} {e.title}</div>
        {items.map((it) => (
          <button key={it.label} className={`menu__item${it.danger ? ' is-danger' : ''}`} data-testid={it.testid}
            onClick={() => { close(); it.run(); }}>{it.label}</button>
        ))}
      </nav>
    </div>
  );
}
