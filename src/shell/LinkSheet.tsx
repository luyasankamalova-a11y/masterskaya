// Связать с объектом из любого места Мастерской (не только с текущей карты).
import { useState } from 'react';
import { linkEntities } from '../core/repo/actions';
import { allEntities, getEntity } from '../core/repo/queries';
import { typeDef } from '../core/registry/entityTypes';
import { keywordSearch } from '../search/keyword';
import { useLive } from '../store/useLive';
import { useUI } from '../store/ui';
import { Sheet } from './Sheet';

export function LinkSheet({ fromId }: { fromId: string }) {
  const [q, setQ] = useState('');
  const from = useLive(() => getEntity(fromId), [fromId]);
  const list = useLive(async () => {
    const found = q.trim() ? (await keywordSearch(q)).map((h) => h.entity) : (await allEntities()).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 40);
    return found.filter((e) => e.id !== fromId && !e.archivedAt);
  }, [q, fromId]) ?? [];
  const close = () => useUI.setState({ sheet: null, connectFrom: null });

  async function pick(toId: string) {
    const rel = await linkEntities(fromId, toId);
    useUI.setState({ sheet: null, connectFrom: null, justLinked: rel ?? null });
  }

  return (
    <Sheet title={`Связать «${from?.title ?? ''}» с…`} onClose={close}>
      <input className="search-input" autoFocus placeholder="Найти объект" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="results">
        {list.map((e) => (
          <li key={e.id}><button onClick={() => pick(e.id)}><span aria-hidden>{typeDef(e.type).icon}</span><span>{e.title}</span><small>{typeDef(e.type).label}</small></button></li>
        ))}
        {!list.length && <li className="hint">Ничего не нашлось.</li>}
      </ul>
    </Sheet>
  );
}
