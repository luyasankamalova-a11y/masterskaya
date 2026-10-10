// Простой поиск по всей Мастерской (офлайн). Смысловой и разговорный — этап 9.
import { useState } from 'react';
import { keywordSearch } from '../search/keyword';
import { typeDef } from '../core/registry/entityTypes';
import { openEntity } from '../app/navigation';
import { useLive } from '../store/useLive';
import { useUI } from '../store/ui';
import { Sheet } from './Sheet';

export function SearchSheet() {
  const [q, setQ] = useState('');
  const hits = useLive(() => (q.trim().length > 1 ? keywordSearch(q) : Promise.resolve(null)), [q]);
  const close = useUI((s) => s.close);
  return (
    <Sheet title="Поиск" onClose={close}>
      <input className="search-input" type="search" autoFocus placeholder="фундаменты, тоннель, Основания…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="search-input" />
      <ul className="results" data-testid="search-results">
        {hits?.map((h) => (
          <li key={h.entity.id}>
            <button onClick={() => openEntity(h.entity)}>
              <span aria-hidden>{typeDef(h.entity.type).icon}</span>
              <span>{h.entity.title}{h.entity.archivedAt ? ' · в архиве' : ''}</span>
              <small>{typeDef(h.entity.type).label} · совпало: {h.why}</small>
            </button>
          </li>
        ))}
        {hits && !hits.length && <li className="hint">Ничего не нашлось. Попробуй другое слово.</li>}
      </ul>
    </Sheet>
  );
}
