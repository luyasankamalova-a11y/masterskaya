// После создания связи — тихая полоска: выбрать тип (необязательно).
import { useEffect, useState } from 'react';
import type { RelationKind } from '../core/model/types';
import { setRelationKind } from '../core/repo/actions';
import { getEntity } from '../core/repo/queries';
import { RELATION_KINDS } from '../core/registry/relationKinds';
import { useLive } from '../store/useLive';
import { useUI } from '../store/ui';

export function LinkKindBar() {
  const rel = useUI((s) => s.justLinked);
  const names = useLive(async () => rel ? [await getEntity(rel.fromId), await getEntity(rel.toId)] : null, [rel?.id]);
  const [kind, setKind] = useState<RelationKind | undefined>(rel?.kind);
  useEffect(() => setKind(rel?.kind), [rel?.id]);
  if (!rel) return null;
  const done = () => useUI.setState({ justLinked: null });
  const choose = async (k?: RelationKind) => { setKind(k); await setRelationKind(rel, k); };
  return (
    <div className="kindbar" role="status" data-testid="kindbar">
      <span className="kindbar__what">Связано: «{names?.[0]?.title}» — «{names?.[1]?.title}». Тип связи:</span>
      <div className="chips">
        {RELATION_KINDS.filter((k) => !k.system).map((k) => (
          <button key={k.kind} className={`chip chip--small${kind === k.kind ? ' is-on' : ''}`} onClick={() => choose(k.kind)}>{k.icon} {k.label}</button>
        ))}
        <button className={`chip chip--small${!kind ? ' is-on' : ''}`} onClick={() => choose(undefined)}>без типа</button>
      </div>
      <button className="btn btn--small" onClick={done}>Готово</button>
    </div>
  );
}
