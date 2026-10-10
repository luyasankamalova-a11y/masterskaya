// «Превратить в проект». Идея остаётся идеей; появляется новый проект —вырос из→ идея.
// Связанные объекты встают на карту проекта как позиции (не копии), их связи сохраняются,
// и каждый дополнительно связывается с проектом. Что взять — решает пользователь.
import { useEffect, useState } from 'react';
import { growIntoProject, growthAround } from '../core/repo/actions';
import { getEntity } from '../core/repo/queries';
import { typeDef } from '../core/registry/entityTypes';
import { openEntity } from '../app/navigation';
import { sirian } from '../sirian/controller';
import { useLive } from '../store/useLive';
import { toast, useUI } from '../store/ui';
import { Sheet } from './Sheet';

export function GrowSheet({ ideaId }: { ideaId: string }) {
  const data = useLive(async () => ({ idea: await getEntity(ideaId), grown: await growthAround(ideaId) }), [ideaId]);
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!data?.idea) return;
    setTitle(data.idea.title);
    setPicked(new Set(data.grown.map((e) => e.id)));
  }, [data?.idea?.id, data?.grown.length]);
  const close = useUI((s) => s.close);
  if (!data?.idea) return null;

  async function grow() {
    setBusy(true);
    const p = await growIntoProject(ideaId, { title: title.trim() || data!.idea!.title, includeIds: [...picked] });
    close();
    if (p) {
      sirian.flare();
      toast(`Проект «${p.title}» вырос из идеи`);
      openEntity(p);
    }
  }

  return (
    <Sheet title="Превратить в проект" onClose={close}>
      <p className="lead">Идея «{data.idea.title}» останется на своём месте. Появится новый проект со связью «🌱 вырос из идеи».</p>
      <label className="field"><span>Название проекта</span><input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="grow-title" /></label>
      {data.grown.length > 0 ? (
        <div className="field">
          <span>Взять на карту проекта — с их связями, без копий</span>
          <ul className="picklist">
            {data.grown.map((e) => (
              <li key={e.id}>
                <label className="check">
                  <input type="checkbox" checked={picked.has(e.id)} onChange={(ev) => {
                    const n = new Set(picked);
                    if (ev.target.checked) n.add(e.id); else n.delete(e.id);
                    setPicked(n);
                  }} />
                  {typeDef(e.type).icon} {e.title} <small>{typeDef(e.type).label}</small>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : <p className="hint">Вокруг идеи пока ничего не выросло — проект начнётся с одной идеи.</p>}
      <div className="row-end">
        <button className="btn" onClick={close}>Не сейчас</button>
        <button className="btn btn--primary" onClick={grow} disabled={busy} data-testid="grow-confirm">Создать проект</button>
      </div>
    </Sheet>
  );
}
