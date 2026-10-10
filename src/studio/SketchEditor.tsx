// Базовая Студия: бесконечный холст, перо и карандаш с нажимом, ластик, отмена/повтор,
// перемещение и масштаб. Эскиз хранится как структура штрихов (SketchDoc) и сохраняется сам.
// В режиме «Чистое пространство»: назад, Сириан и инструменты — больше ничего.
import { type PointerEvent as RPE, type WheelEvent as RWE, useEffect, useRef, useState } from 'react';
import type { Entity, SketchDoc, Stroke, Viewport } from '../core/model/types';
import { saveSketch, updateEntity } from '../core/repo/actions';
import { getEntity, getSketch } from '../core/repo/queries';
import { ulid } from '../core/ulid';
import { dist, hasSeenPen, isPalm, notePointer } from '../input/pointer';
import { clampZoom, type Size, toWorld, zoomAt } from '../maps/viewport';
import { back } from '../app/router';
import { useUI } from '../store/ui';
import { hitsStroke, strokePath, strokesBounds } from './strokeGeometry';
import { useSketchHistory } from './useSketchHistory';
import { sirian } from '../sirian/controller';

type Tool = 'pen' | 'pencil' | 'eraser' | 'hand';
const COLORS = [
  { c: '#ece6da', name: 'Мел' }, { c: '#d9ad62', name: 'Золото' },
  { c: '#86b6dc', name: 'Холодный голубой' }, { c: '#e07f6c', name: 'Пометка' },
];
const SIZES = [2, 4, 8];
const LAYER_ID = 'layer:drawing';

export function SketchEditor({ entityId }: { entityId: string }) {
  const [entity, setEntity] = useState<Entity | null | undefined>();
  const [doc, setDoc] = useState<SketchDoc | null>(null);

  useEffect(() => {
    let alive = true;
    sirian.setContext('studio');
    (async () => {
      const e = await getEntity(entityId);
      const d = await getSketch(entityId);
      if (!alive) return;
      setEntity(e ?? null);
      setDoc(d ?? { entityId, layers: [{ id: LAYER_ID, name: 'Рисунок', visible: true, locked: false }], elements: [], updatedAt: Date.now() });
    })();
    return () => { alive = false; };
  }, [entityId]);

  if (entity === undefined || !doc) return <div className="studio" />;
  if (entity === null) return <div className="screen-message">Этого эскиза больше нет.</div>;
  return <Canvas key={entityId} entity={entity} doc={doc} />;
}

function Canvas({ entity, doc }: { entity: Entity; doc: SketchDoc }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ w: 1024, h: 700 });
  const [v, setV] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0].c);
  const [width, setWidth] = useState(SIZES[1]);
  const [live, setLive] = useState<Stroke | null>(null);
  const [saved, setSaved] = useState(true);
  const { strokes, commit, undo, redo, canUndo, canRedo } = useSketchHistory(doc.elements);
  const pointers = useRef(new Map<number, { x: number; y: number; type: string }>());
  const gesture = useRef<{ kind: 'none' | 'draw' | 'erase' | 'pan' | 'pinch'; start?: { x: number; y: number }; v0?: Viewport; d0?: number; mid0?: { x: number; y: number }; before?: Stroke[]; erased?: boolean }>({ kind: 'none' });
  const liveRef = useRef<Stroke | null>(null);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const vRef = useRef(v);
  vRef.current = v;

  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    const s = { w: el.clientWidth, h: el.clientHeight };
    setSize(s);
    const b = strokesBounds(doc.elements);
    if (b) {
      const zoom = clampZoom(Math.min(1.4, s.w / (b.maxX - b.minX + 200), s.h / (b.maxY - b.minY + 200)));
      setV({ zoom, x: -((b.minX + b.maxX) / 2) * zoom, y: -((b.minY + b.maxY) / 2) * zoom });
    }
    return () => ro.disconnect();
  }, []);

  // Автосохранение структуры эскиза (с задержкой, и при выходе).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSaved(false);
    const t = setTimeout(async () => {
      await saveSketch({ ...doc, elements: strokesRef.current });
      setSaved(true);
    }, 500);
    return () => clearTimeout(t);
  }, [strokes]);
  useEffect(() => () => { if (strokesRef.current !== doc.elements) saveSketch({ ...doc, elements: strokesRef.current }); }, []);

  // Клавиши: Ctrl+Z / Ctrl+Shift+Z, B — перо, E — ластик, H — рука
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if (e.key === 'b') setTool('pen'); else if (e.key === 'e') setTool('eraser'); else if (e.key === 'h') setTool('hand');
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [undo, redo]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const world = (pt: { x: number; y: number }) => toWorld(vRef.current, size, pt.x, pt.y);
  /** Палец рисует, только пока на устройстве не замечен стилус (тогда палец двигает холст). */
  const draws = (type: string) => tool !== 'hand' && (type === 'pen' || type === 'mouse' || (type === 'touch' && !hasSeenPen()));

  function eraseAt(pt: { x: number; y: number }) {
    const w = world(pt);
    const r = 12 / vRef.current.zoom;
    const base = eraseRef.current ?? strokesRef.current;
    const keep = base.filter((s) => !hitsStroke(s, w.x, w.y, r));
    if (keep.length !== base.length) {
      eraseRef.current = keep;
      gesture.current.erased = true;
      setLiveErase(keep);
    }
  }
  const [liveErase, setLiveErase] = useState<Stroke[] | null>(null);
  const eraseRef = useRef<Stroke[] | null>(null);

  function down(e: RPE<HTMLDivElement>) {
    notePointer(e, 'down');
    if (isPalm(e)) return;
    try { box.current!.setPointerCapture(e.pointerId); } catch { /* указатель уже отпущен */ }
    const pt = local(e);
    pointers.current.set(e.pointerId, { ...pt, type: e.pointerType });
    if (pointers.current.size === 2) {
      // Второй палец: отменяем начатую линию и переходим к масштабу.
      liveRef.current = null; setLive(null);
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: 'pinch', d0: dist(a, b), mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v0: vRef.current };
      return;
    }
    if (pointers.current.size > 2) return;
    const eraser = tool === 'eraser' || e.button === 5 || (e.pointerType === 'pen' && (e.buttons & 32) === 32);
    if (draws(e.pointerType) && eraser) {
      gesture.current = { kind: 'erase', before: strokesRef.current, erased: false };
      eraseAt(pt);
    } else if (draws(e.pointerType) && e.button !== 1 && e.button !== 2) {
      const w = world(pt);
      const s: Stroke = {
        id: ulid(), kind: 'stroke', tool: tool === 'pencil' ? 'pencil' : 'pen', color, size: width, layerId: LAYER_ID,
        points: [[w.x, w.y, e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5]],
      };
      liveRef.current = s; setLive(s);
      gesture.current = { kind: 'draw' };
    } else {
      gesture.current = { kind: 'pan', start: pt, v0: vRef.current };
    }
  }

  function move(e: RPE<HTMLDivElement>) {
    notePointer(e, 'move');
    if (!pointers.current.has(e.pointerId)) return;
    const pt = local(e);
    pointers.current.set(e.pointerId, { ...pt, type: e.pointerType });
    const g = gesture.current;
    if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const z = zoomAt(g.v0!, size, g.mid0!.x, g.mid0!.y, dist(a, b) / g.d0!);
      setV({ ...z, x: z.x + mid.x - g.mid0!.x, y: z.y + mid.y - g.mid0!.y });
    } else if (g.kind === 'pan') {
      setV({ ...g.v0!, x: g.v0!.x + pt.x - g.start!.x, y: g.v0!.y + pt.y - g.start!.y });
    } else if (g.kind === 'erase') {
      eraseAt(pt);
    } else if (g.kind === 'draw' && liveRef.current) {
      const native = e.nativeEvent;
      const events = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [native];
      const pts = liveRef.current.points.slice();
      for (const ce of events.length ? events : [native]) {
        const w = world(local(ce));
        const last = pts[pts.length - 1];
        if (Math.hypot(w.x - last[0], w.y - last[1]) * vRef.current.zoom < 1.2) continue;
        pts.push([w.x, w.y, ce.pointerType === 'pen' ? ce.pressure || 0.5 : 0.5]);
      }
      liveRef.current = { ...liveRef.current, points: pts };
      setLive(liveRef.current);
    }
  }

  function up(e: RPE<HTMLDivElement>) {
    notePointer(e, 'up');
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g.kind === 'draw' && liveRef.current) {
      const s = liveRef.current;
      liveRef.current = null; setLive(null);
      commit([...strokesRef.current, s], strokesRef.current);
    } else if (g.kind === 'erase') {
      if (g.erased && eraseRef.current) commit(eraseRef.current, g.before!);
      eraseRef.current = null;
      setLiveErase(null);
    }
    if (!pointers.current.size) gesture.current = { kind: 'none' };
  }

  function wheel(e: RWE) {
    const pt = local(e);
    if (e.ctrlKey || (!e.shiftKey && e.deltaX === 0)) setV((c) => zoomAt(c, size, pt.x, pt.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))));
    else setV((c) => ({ ...c, x: c.x - e.deltaX, y: c.y - e.deltaY }));
  }

  const shown = liveErase ?? strokes;
  const grid = 48 * v.zoom;

  return (
    <div className="studio" data-testid="studio">
      <div
        ref={box}
        className={`studio__canvas tool-${tool}`}
        style={{ backgroundSize: `${grid}px ${grid}px, ${grid}px ${grid}px, ${grid * 5}px ${grid * 5}px, ${grid * 5}px ${grid * 5}px`, backgroundPosition: `${size.w / 2 + v.x}px ${size.h / 2 + v.y}px` }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onWheel={wheel} onContextMenu={(e) => e.preventDefault()}
        data-testid="canvas"
      >
        <svg width={size.w} height={size.h} aria-label={`Эскиз «${entity.title}»`} role="img">
          <g transform={`translate(${size.w / 2 + v.x} ${size.h / 2 + v.y}) scale(${v.zoom})`}>
            {shown.map((s) => <path key={s.id} d={strokePath(s)} fill={s.color} opacity={s.tool === 'pencil' ? 0.72 : 1} />)}
            {live && <path d={strokePath(live)} fill={live.color} opacity={live.tool === 'pencil' ? 0.72 : 1} />}
          </g>
        </svg>
      </div>

      <header className="studio__top">
        <button className="icon-btn" onClick={back} aria-label="Назад">←</button>
        <SketchTitle entity={entity} />
        <span className="studio__saved" aria-live="polite">{saved ? 'сохранено' : 'сохраняю…'}</span>
        <div className="studio__spacer" />
        <button className="icon-btn" onClick={() => useUI.getState().open({ kind: 'link', fromId: entity.id })} aria-label="Связать эскиз" data-testid="sketch-link">🔗</button>
        <button className="icon-btn" onClick={() => useUI.getState().showPanel(entity.id)} aria-label="Карточка эскиза">⋯</button>
      </header>

      <nav className="studio__tools" aria-label="Инструменты">
        <div className="toolgroup" role="radiogroup" aria-label="Инструмент">
          {([['pen', '✒️', 'Перо'], ['pencil', '✏️', 'Карандаш'], ['eraser', '🧽', 'Ластик'], ['hand', '✋', 'Рука: двигать холст']] as const).map(([t, ic, label]) => (
            <button key={t} role="radio" aria-checked={tool === t} aria-label={label} title={label} className={`tool${tool === t ? ' is-on' : ''}`} onClick={() => setTool(t)} data-testid={`tool-${t}`}>{ic}</button>
          ))}
        </div>
        <div className="toolgroup" role="radiogroup" aria-label="Цвет">
          {COLORS.map((c) => (
            <button key={c.c} role="radio" aria-checked={color === c.c} aria-label={c.name} title={c.name} className={`swatch${color === c.c ? ' is-on' : ''}`} style={{ background: c.c }} onClick={() => setColor(c.c)} />
          ))}
        </div>
        <div className="toolgroup" role="radiogroup" aria-label="Толщина">
          {SIZES.map((s) => (
            <button key={s} role="radio" aria-checked={width === s} aria-label={`Толщина ${s}`} className={`tool tool--size${width === s ? ' is-on' : ''}`} onClick={() => setWidth(s)}><i style={{ width: s + 3, height: s + 3 }} /></button>
          ))}
        </div>
        <div className="toolgroup">
          <button className="tool" onClick={undo} disabled={!canUndo} aria-label="Отменить" title="Отменить (Ctrl+Z)" data-testid="undo">↶</button>
          <button className="tool" onClick={redo} disabled={!canRedo} aria-label="Повторить" title="Повторить (Ctrl+Shift+Z)" data-testid="redo">↷</button>
        </div>
      </nav>
    </div>
  );
}

function SketchTitle({ entity }: { entity: Entity }) {
  const [t, setT] = useState(entity.title);
  return (
    <input
      className="studio__title" value={t} aria-label="Название эскиза"
      onChange={(e) => setT(e.target.value)}
      onBlur={() => { if (t.trim() && t !== entity.title) updateEntity(entity.id, { title: t.trim() }); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}
