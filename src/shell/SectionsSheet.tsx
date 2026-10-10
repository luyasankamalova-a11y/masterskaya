// «☰ Все разделы» — запасная быстрая навигация и «Недавнее». Основной путь — карта.
import { recentEntities } from '../core/repo/queries';
import { AREAS } from '../core/registry/spaces';
import { typeDef } from '../core/registry/entityTypes';
import { go } from '../app/router';
import { openEntity } from '../app/navigation';
import { useLive } from '../store/useLive';
import { useUI } from '../store/ui';
import { Sheet } from './Sheet';

export function SectionsSheet() {
  const close = useUI((s) => s.close);
  const recent = useLive(() => recentEntities(8), [], ['entities']) ?? [];
  return (
    <Sheet title="Все разделы" onClose={close}>
      <nav className="sections">
        <button onClick={() => { close(); go({ name: 'world' }); }}><span aria-hidden>🌌</span>Мой мир</button>
        {AREAS.map((a) => (
          <button key={a.id} onClick={() => { close(); go({ name: 'space', id: a.id }); }}><span aria-hidden>{a.icon}</span>{a.title}</button>
        ))}
      </nav>
      {recent.length > 0 && (
        <>
          <h3 className="sub">Недавнее</h3>
          <ul className="results">
            {recent.map((e) => (
              <li key={e.id}><button onClick={() => openEntity(e)}><span aria-hidden>{typeDef(e.type).icon}</span><span>{e.title}</span><small>{typeDef(e.type).label}</small></button></li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
