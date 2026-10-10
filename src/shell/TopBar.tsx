// Верхняя полоса: назад и где я — слева; поиск, ＋, разделы, настройки — справа.
import { back, type Route } from '../app/router';
import { getEntity, getSpace } from '../core/repo/queries';
import { spaceTitle } from '../spaces/SpaceView';
import { useLive } from '../store/useLive';
import { useUI } from '../store/ui';
import { currentMode } from '../core/db/schema';

export function TopBar({ route }: { route: Route }) {
  const open = useUI((s) => s.open);
  const where = useLive(async () => {
    if (route.name !== 'space') return null;
    const sp = await getSpace(route.id);
    if (!sp) return null;
    const owner = sp.ownerEntityId ? await getEntity(sp.ownerEntityId) : undefined;
    return { ...spaceTitle(sp, owner), ownerId: owner?.id, spaceId: sp.id };
  }, [route.name === 'space' ? route.id : ''], ['spaces', 'entities']);

  return (
    <header className="topbar">
      <div className="topbar__left">
        {route.name !== 'world' && <button className="icon-btn" onClick={back} aria-label="Назад">←</button>}
        {where && (
          <div className="topbar__where">
            <span className="topbar__icon" aria-hidden>{where.icon}</span>
            <div>
              <div className="topbar__title" data-testid="where">{where.title}</div>
              <div className="topbar__kind">{where.kind}</div>
            </div>
            {where.ownerId && <button className="icon-btn icon-btn--small" aria-label="Карточка" onClick={() => useUI.getState().showPanel(where.ownerId!)}>⋯</button>}
          </div>
        )}
      </div>
      <nav className="topbar__right">
        {currentMode() === 'demo' && <span className="badge-demo" title="Отдельная демо-база">демо</span>}
        <button className="icon-btn" onClick={() => open({ kind: 'search' })} aria-label="Поиск" data-testid="open-search">🔎</button>
        <button className="icon-btn icon-btn--add" onClick={() => open({ kind: 'add', spaceId: where?.spaceId })} aria-label="Добавить" data-testid="open-add">＋</button>
        <button className="icon-btn" onClick={() => open({ kind: 'sections' })} aria-label="Все разделы">☰</button>
        <button className="icon-btn" onClick={() => open({ kind: 'settings' })} aria-label="Настройки" data-testid="open-settings">⚙</button>
      </nav>
    </header>
  );
}
