// Карточка объекта: всё об одном объекте и всё, что с ним можно сделать.
// Изменить, связать, архивировать, удалить, запретить AI — без длинных форм.
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import type { Entity, FileRef, Relation, RelationKind } from '../core/model/types';
import {
  archiveEntity, deleteEntity, projectGrownFrom, restoreEntity, setRelationKind, unlink, updateEntity,
} from '../core/repo/actions';
import { getEntity, neighbours, whereIs } from '../core/repo/queries';
import { type MetaField, typeDef } from '../core/registry/entityTypes';
import { RELATION_KINDS, relationDef } from '../core/registry/relationKinds';
import { areaById } from '../core/registry/spaces';
import { fileUrl, formatSize, storeFile } from '../files/fileStore';
import { openEntity } from '../app/navigation';
import { go } from '../app/router';
import { useLive } from '../store/useLive';
import { toast, useUI } from '../store/ui';
import { confirmAction } from './confirm';
import { dateLabel, dueLabel, useImageUrl } from './format';

export function EntityPanel({ id }: { id: string }) {
  const e = useLive(() => getEntity(id), [id], ['entities']);
  const close = () => useUI.getState().showPanel(null);
  useEffect(() => {
    const k = (ev: KeyboardEvent) => { if (ev.key === 'Escape') close(); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  if (e === undefined) return null;
  if (!e) { close(); return null; }
  const def = typeDef(e.type);

  return (
    <aside className="panel" aria-label={`Карточка: ${e.title}`} data-testid="panel">
      <header className="panel__head">
        <span className="panel__type"><span aria-hidden>{def.icon}</span>{def.label}{e.archivedAt ? ' · в архиве' : ''}</span>
        <button className="icon-btn" onClick={close} aria-label="Закрыть карточку">✕</button>
      </header>
      <div className="panel__scroll">
        <EditableTitle e={e} />
        {e.type === 'assignment' && dueLabel(e.meta.dueDate) && <p className="panel__due">📅 {dueLabel(e.meta.dueDate)}</p>}
        <Hero e={e} />
        <div className="panel__actions">
          {(def.ownSpace || e.type === 'sketch') && (
            <button className="btn btn--primary" onClick={() => openEntity(e)}>{e.type === 'sketch' ? 'Открыть в Студии' : 'Открыть карту'}</button>
          )}
          <button className="btn" onClick={() => useUI.setState({ connectFrom: e.id, panelId: null })}>🔗 Связать</button>
          {e.type === 'idea' && <GrowButton idea={e} />}
        </div>
        {def.statuses && <Statuses e={e} />}
        {def.metaFields?.map((f) => <MetaInput key={f.key} e={e} f={f} />)}
        <TextArea e={e} field="description" label="Описание" />
        <TextArea e={e} field="body" label={e.type === 'topic' ? 'Как я это понимаю' : 'Заметка'} rows={5} />
        <Attachments e={e} />
        <Links e={e} />
        <Places e={e} />
        <label className="check panel__ai">
          <input type="checkbox" checked={e.aiAccess === 'blocked'} onChange={(ev) => updateEntity(e.id, { aiAccess: ev.target.checked ? 'blocked' : 'allowed' })} />
          🔒 Не использовать AI для этого объекта
        </label>
        <p className="panel__dates">Создан {dateLabel(e.createdAt)} · изменён {dateLabel(e.updatedAt)}</p>
        <div className="panel__danger">
          {e.archivedAt
            ? <button className="btn" onClick={() => restoreEntity(e.id)}>Вернуть из архива</button>
            : <button className="btn" onClick={async () => { await archiveEntity(e.id); toast('Объект в архиве — вернуть можно в настройках'); close(); }}>В архив</button>}
          <button className="btn btn--danger" onClick={async () => {
            if (await confirmAction(`Удалить «${e.title}»? Вместе с ним уйдут его связи и места на всех картах.`)) {
              await deleteEntity(e.id); close(); toast('Удалено');
            }
          }}>Удалить</button>
        </div>
      </div>
    </aside>
  );
}

function EditableTitle({ e }: { e: Entity }) {
  const [v, setV] = useState(e.title);
  useEffect(() => setV(e.title), [e.title]);
  const save = () => { const t = v.trim(); if (t && t !== e.title) updateEntity(e.id, { title: t }); else setV(e.title); };
  return (
    <textarea
      className="panel__title" value={v} rows={1} aria-label="Название"
      onChange={(ev) => setV(ev.target.value)} onBlur={save}
      onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); (ev.target as HTMLTextAreaElement).blur(); } }}
    />
  );
}

function Hero({ e }: { e: Entity }) {
  const img = useImageUrl(e);
  return img ? <img className="panel__hero" src={img} alt="" /> : null;
}

function Statuses({ e }: { e: Entity }) {
  const def = typeDef(e.type);
  return (
    <div className="field">
      <span>{e.type === 'topic' ? 'Понимание' : 'Статус'}</span>
      <div className="chips">
        {def.statuses!.map((s) => (
          <button key={s.id} className={`chip chip--status${e.status === s.id ? ' is-on' : ''}`} style={{ '--status': s.color } as CSSProperties}
            onClick={() => updateEntity(e.id, { status: s.id })} aria-pressed={e.status === s.id}>
            <i aria-hidden />{s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MetaInput({ e, f }: { e: Entity; f: MetaField }) {
  const value = (e.meta[f.key] as string | undefined) ?? '';
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const save = (nv: string) => { if (nv !== value) updateEntity(e.id, { meta: { [f.key]: nv || undefined } }); };
  if (f.kind === 'select') {
    return (
      <label className="field"><span>{f.label}</span>
        <select value={value} onChange={(ev) => save(ev.target.value)}>
          <option value="">—</option>
          {f.options!.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
    );
  }
  if (f.kind === 'date') {
    return <label className="field"><span>{f.label}</span><input type="date" value={value} onChange={(ev) => save(ev.target.value)} /></label>;
  }
  return (
    <label className="field"><span>{f.label}</span>
      {f.kind === 'longtext'
        ? <textarea rows={3} value={v} placeholder={f.placeholder} onChange={(ev) => setV(ev.target.value)} onBlur={() => save(v)} />
        : <input type={f.kind === 'url' ? 'url' : 'text'} value={v} placeholder={f.placeholder} onChange={(ev) => setV(ev.target.value)} onBlur={() => save(v)} />}
      {f.kind === 'url' && value && <a className="link-out" href={value} target="_blank" rel="noreferrer">Открыть ссылку ↗</a>}
    </label>
  );
}

function TextArea({ e, field, label, rows = 2 }: { e: Entity; field: 'description' | 'body'; label: string; rows?: number }) {
  const value = e[field] ?? '';
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="field"><span>{label}</span>
      <textarea rows={rows} value={v} onChange={(ev) => setV(ev.target.value)} onBlur={() => { if (v !== value) updateEntity(e.id, { [field]: v }); }} />
    </label>
  );
}

function Attachments({ e }: { e: Entity }) {
  const input = useRef<HTMLInputElement>(null);
  async function add(f: File | undefined) {
    if (!f) return;
    const ref = await storeFile(f);
    await updateEntity(e.id, { attachments: [...e.attachments, ref] });
  }
  async function open(a: FileRef) {
    const u = await fileUrl(a.fileId);
    if (u) window.open(u, '_blank');
    else toast('Файл не найден в хранилище');
  }
  return (
    <div className="field">
      <span>Файлы</span>
      <ul className="files">
        {e.attachments.map((a) => (
          <li key={a.fileId}>
            <button className="linklike" onClick={() => open(a)}>{a.name}</button>
            <small>{formatSize(a.size)}</small>
          </li>
        ))}
      </ul>
      <button className="btn btn--small" onClick={() => input.current?.click()}>Прикрепить файл</button>
      <input ref={input} type="file" hidden onChange={(ev) => add(ev.target.files?.[0])} />
    </div>
  );
}

function Links({ e }: { e: Entity }) {
  const list = useLive(() => neighbours(e.id), [e.id], ['relations', 'entities']) ?? [];
  return (
    <div className="field" data-testid="links">
      <span>Связи</span>
      {!list.length && <p className="hint">Пока ни с чем не связан.</p>}
      <ul className="links">
        {list.map(({ relation, entity, direction }) => (
          <li key={relation.id}>
            <KindSelect rel={relation} />
            <span className="links__dir" aria-hidden>{direction === 'out' ? '→' : '←'}</span>
            <button className="linklike" onClick={() => openEntity(entity)}>{typeDef(entity.type).icon} {entity.title}</button>
            {relation.kind !== 'grew_from' && (
              <button className="icon-btn icon-btn--small" aria-label={`Разорвать связь с «${entity.title}»`} onClick={() => unlink(relation)}>✕</button>
            )}
          </li>
        ))}
      </ul>
      <div className="row">
        <button className="btn btn--small" onClick={() => useUI.getState().open({ kind: 'link', fromId: e.id })}>＋ Найти и связать</button>
      </div>
    </div>
  );
}

function KindSelect({ rel }: { rel: Relation }) {
  const def = relationDef(rel.kind);
  if (def?.system) return <span className="links__kind">{def.icon} {def.label}</span>;
  return (
    <select className="links__kind" value={rel.kind ?? ''} aria-label="Тип связи"
      onChange={(ev) => setRelationKind(rel, (ev.target.value || undefined) as RelationKind | undefined)}>
      <option value="">связь</option>
      {RELATION_KINDS.filter((k) => !k.system).map((k) => <option key={k.kind} value={k.kind}>{k.icon} {k.label}</option>)}
    </select>
  );
}

function Places({ e }: { e: Entity }) {
  const list = useLive(() => whereIs(e.id), [e.id], ['placements', 'spaces']) ?? [];
  const owners = useLive(async () => Promise.all(list.map((x) => (x.space.ownerEntityId ? getEntity(x.space.ownerEntityId) : undefined))), [list.map((x) => x.space.id).join()], ['entities']) ?? [];
  return (
    <div className="field">
      <span>Где лежит</span>
      {!list.length && <p className="hint">Ни на одной карте{typeDef(e.type).isMaterial ? ' — лежит в «Неразобранном» Библиотеки' : ''}.</p>}
      <div className="chips">
        {list.map((x, i) => (
          <button key={x.placement.id} className="chip" onClick={() => { useUI.getState().showPanel(null); go({ name: 'space', id: x.space.id }); }}>
            {owners[i] ? `${typeDef(owners[i]!.type).icon} ${owners[i]!.title}` : `${areaById(x.space.id)?.icon ?? ''} ${areaById(x.space.id)?.title ?? x.space.title}`}
          </button>
        ))}
      </div>
    </div>
  );
}

function GrowButton({ idea }: { idea: Entity }) {
  const grown = useLive(() => projectGrownFrom(idea.id), [idea.id], ['relations', 'entities']);
  if (grown) return <button className="btn" onClick={() => openEntity(grown)}>🌱 Выросла в «{grown.title}»</button>;
  return <button className="btn" onClick={() => useUI.getState().open({ kind: 'grow', ideaId: idea.id })}>🏗️ Превратить в проект</button>;
}
