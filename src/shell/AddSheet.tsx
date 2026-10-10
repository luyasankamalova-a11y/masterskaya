// «＋ Добавить». Короткий путь: тип → название → (файл / ссылка / срок) → сохранить.
// Учитывает место: внутри дисциплины предлагает «Добавить в „Механику грунтов“».
// Материал без места попадает в «Неразобранное» Библиотеки.
import { useMemo, useRef, useState } from 'react';
import type { EntityType, FileRef } from '../core/model/types';
import { createEntity, freeSpot } from '../core/repo/actions';
import { getEntity, getSpace } from '../core/repo/queries';
import { ENTITY_TYPES, FILE_TYPES, isMaterial, typeDef, URL_TYPES } from '../core/registry/entityTypes';
import { areaById, defaultAreaFor, OWN_SPACE_ADD } from '../core/registry/spaces';
import { formatSize, guessType, storeFile } from '../files/fileStore';
import { viewCenter } from '../maps/center';
import { go } from '../app/router';
import { useLive } from '../store/useLive';
import { toast, useUI } from '../store/ui';
import { Sheet } from './Sheet';

const QUICK: EntityType[] = ['idea', 'question', 'note', 'photo', 'pdf', 'link', 'book', 'article', 'video', 'sketch', 'discipline', 'research', 'project', 'object', 'inspiration'];

export function AddSheet({ spaceId, at }: { spaceId?: string; at?: { x: number; y: number } }) {
  const close = useUI((s) => s.close);
  const ctx = useLive(async () => {
    if (!spaceId) return { types: QUICK, label: null as string | null };
    const space = await getSpace(spaceId);
    const owner = space?.ownerEntityId ? await getEntity(space.ownerEntityId) : undefined;
    const types = (space && OWN_SPACE_ADD[space.kind]) ?? areaById(spaceId)?.addTypes ?? QUICK;
    return { types: types.length ? types : QUICK, label: owner ? owner.title : areaById(spaceId)?.title ?? null };
  }, [spaceId]);

  const [type, setType] = useState<EntityType | null>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [due, setDue] = useState('');
  const [inHere, setInHere] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const t: EntityType | null = type ?? ctx?.types[0] ?? null;
  const def = t ? typeDef(t) : null;
  const wantsFile = !!t && (FILE_TYPES.includes(t) || isMaterial(t));
  const wantsUrl = !!t && URL_TYPES.includes(t);

  const target = useMemo(() => {
    if (!t) return undefined;
    if (spaceId && inHere) return spaceId;
    return defaultAreaFor(t);
  }, [t, spaceId, inHere]);

  async function save() {
    if (!t || busy) return;
    setBusy(true);
    try {
      let attachments: FileRef[] = [];
      if (file) attachments = [await storeFile(file)];
      const meta: Record<string, unknown> = {};
      if (url.trim()) meta.url = url.trim();
      if (due) meta.dueDate = due;
      const name = title.trim() || file?.name.replace(/\.[^.]+$/, '') || '';
      const pos = target ? (target === spaceId && at ? at : await freeSpot(target, viewCenter(target))) : undefined;
      const e = await createEntity({ type: t, title: name, meta, attachments, spaceId: target, at: pos });
      close();
      if (t === 'sketch') go({ name: 'sketch', id: e.id });
      else if (!target) toast(`«${e.title}» — в «Неразобранном» Библиотеки`);
      else if (target !== spaceId) toast(`«${e.title}» — в разделе «${areaById(target)?.title ?? ''}»`);
    } catch (err) {
      toast(`Не сохранилось: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function pickFile(f: File | null) {
    setFile(f);
    if (!f) return;
    const guessed = guessType(f);
    if (!type && ctx?.types.includes(guessed)) setType(guessed);
  }

  return (
    <Sheet title="Добавить" onClose={close}>
      <form className="add" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="chips" role="radiogroup" aria-label="Что добавить">
          {(ctx?.types ?? []).map((ty) => (
            <button
              type="button" key={ty} role="radio" aria-checked={t === ty}
              className={`chip${t === ty ? ' is-on' : ''}`} onClick={() => setType(ty)}
            >
              <span aria-hidden>{ENTITY_TYPES[ty].icon}</span>{ENTITY_TYPES[ty].label}
            </button>
          ))}
        </div>

        <label className="field">
          <span>Название</span>
          <input
            autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder={def?.titlePrompt ?? (file ? file.name : def?.label)}
            data-testid="add-title"
          />
        </label>

        {wantsUrl && (
          <label className="field"><span>Ссылка</span><input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></label>
        )}
        {wantsFile && (
          <div className="field">
            <span>Файл {FILE_TYPES.includes(t!) ? '' : '(необязательно)'}</span>
            <div className="file-pick">
              <button type="button" className="btn" onClick={() => fileInput.current?.click()}>{file ? 'Другой файл' : 'Выбрать файл'}</button>
              {file && <span>{file.name} · {formatSize(file.size)}</span>}
              <input ref={fileInput} type="file" hidden data-testid="add-file"
                accept={t === 'photo' ? 'image/*' : undefined}
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
        )}
        {t === 'assignment' && (
          <label className="field"><span>Срок (если нужен)</span><input type="date" value={due} onChange={(e) => setDue(e.target.value)} data-testid="add-due" /></label>
        )}

        {spaceId && ctx?.label && (
          <label className="check">
            <input type="checkbox" checked={inHere} onChange={(e) => setInHere(e.target.checked)} />
            Добавить в «{ctx.label}»
          </label>
        )}
        {t && !target && <p className="hint">Без места — попадёт в «Неразобранное» Библиотеки. Разложить можно потом.</p>}

        <div className="row-end">
          <button type="button" className="btn" onClick={close}>Отмена</button>
          <button type="submit" className="btn btn--primary" disabled={!t || busy} data-testid="add-save">
            {t === 'sketch' ? 'Начать эскиз' : 'Сохранить'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
