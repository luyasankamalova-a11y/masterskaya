// Общий движок карт. Рисует любое пространство (Space): узлы — позиции объектов,
// связи — кривые между ними. Характер карты задаёт тема (CSS), а не отдельный код.
//
// Жесты:
//   1 палец / мышь по фону — перемещение карты; 2 пальца, колесо — масштаб;
//   палец / мышь по узлу — перетащить узел; стилус по узлу — протянуть связь;
//   кольцо-ручка выделенного узла — протянуть связь любым указателем;
//   двойное нажатие на узел — открыть; долгое нажатие / правая кнопка — меню;
//   двойное нажатие / долгое нажатие на пустом месте — добавить сюда.
import {
  type CSSProperties, type KeyboardEvent as RKE, type MouseEvent as RME, type PointerEvent as RPE, type ReactNode,
  type WheelEvent as RWE, useEffect, useMemo, useRef, useState,
} from 'react';
import type { Entity, ID, Placement, Relation, SketchDoc, Viewport } from '../core/model/types';
import type { MapNode } from '../core/repo/queries';
import { saveViewport } from '../core/repo/actions';
import { DOUBLE_TAP_MS, dist, isPalm, LONG_PRESS_MS, MOVE_SLOP, notePointer } from '../input/pointer';
import { Edges } from './Edges';
import { NodeCard } from './NodeCard';
import { fitTo, type Size, toWorld, zoomAt } from './viewport';
import { setMapCenter } from './center';

export interface MapViewProps {
  spaceId: ID;
  theme: string;
  nodes: MapNode[];
  relations: Relation[];
  outside: Record<ID, number>;
  sketches: Record<ID, SketchDoc>;
  initialViewport: Viewport;
  connectFrom: ID | null;
  onOpen: (e: Entity) => void;
  onMenu: (node: MapNode, clientX: number, clientY: number) => void;
  onConnect: (fromId: ID, toId: ID) => void;
  onAddAt: (pt: { x: number; y: number }) => void;
  onMove: (p: Placement, x: number, y: number) => void;
  onPickTarget?: (e: Entity) => void;
  emptyHint?: ReactNode;
}

type Mode =
  | { kind: 'idle' }
  | { kind: 'press-bg'; start: { x: number; y: number }; v0: Viewport }
  | { kind: 'pan'; start: { x: number; y: number }; v0: Viewport }
  | { kind: 'pinch'; d0: number; mid0: { x: number; y: number }; v0: Viewport }
  | { kind: 'press-node'; node: MapNode; start: { x: number; y: number }; pen: boolean; handle: boolean }
  | { kind: 'drag'; node: MapNode; start: { x: number; y: number } }
  | { kind: 'connect'; node: MapNode };

export function MapView(p: MapViewProps) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [v, setV] = useState<Viewport>(p.initialViewport);
  const [dragPos, setDragPos] = useState<{ id: ID; x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<{ from: ID; to: { x: number; y: number } } | null>(null);
  const [hoverTarget, setHoverTarget] = useState<ID | null>(null);
  const [selected, setSelected] = useState<ID | null>(null);
  const mode = useRef<Mode>({ kind: 'idle' });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastTap = useRef<{ id: string; at: number }>({ id: '', at: 0 });
  const vRef = useRef(v);
  vRef.current = v;

  // Размер контейнера
  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Первое открытие карты с узлами — вписать их в экран.
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || !p.nodes.length || !size.w) return;
    fitted.current = true;
    const iv = p.initialViewport;
    if (iv.x === 0 && iv.y === 0 && iv.zoom === 1) setV(fitTo(p.nodes.map((n) => n.placement), size));
  }, [p.nodes.length, size.w]);

  // Сохранение камеры (без журнала и outbox — это не данные пользователя).
  useEffect(() => {
    if (!size.w) return;
    const t = setTimeout(() => saveViewport(p.spaceId, v), 700);
    setMapCenter(p.spaceId, toWorld(v, size, size.w / 2, size.h / 2));
    return () => clearTimeout(t);
  }, [v, size, p.spaceId]);

  const byEntity = useMemo(() => new Map(p.nodes.map((n) => [n.entity.id, n])), [p.nodes]);
  const posOf = (id: ID) => {
    const n = byEntity.get(id);
    if (!n) return undefined;
    return dragPos?.id === n.placement.id ? dragPos : n.placement;
  };

  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const nodeAt = (clientX: number, clientY: number): MapNode | undefined => {
    const el = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-node]');
    return el ? byEntity.get(el.dataset.node!) : undefined;
  };
  const clearTimer = () => clearTimeout(timer.current);

  function onPointerDown(e: RPE<HTMLDivElement>) {
    notePointer(e, 'down');
    if (isPalm(e) || e.button === 2) return;
    try { box.current!.setPointerCapture(e.pointerId); } catch { /* указатель уже отпущен */ }
    const pt = local(e);
    pointers.current.set(e.pointerId, pt);

    if (pointers.current.size === 2) {
      clearTimer();
      setDragPos(null); setDraft(null);
      const [a, b] = [...pointers.current.values()];
      mode.current = { kind: 'pinch', d0: dist(a, b), mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v0: vRef.current };
      return;
    }
    if (pointers.current.size > 2) return;

    const target = e.target as HTMLElement;
    const nodeEl = target.closest<HTMLElement>('[data-node]');
    const node = nodeEl ? byEntity.get(nodeEl.dataset.node!) : undefined;
    if (node) {
      // В режиме «выбери второй объект» нажатие на узел завершает связь.
      if (p.connectFrom && p.onPickTarget) { p.onPickTarget(node.entity); mode.current = { kind: 'idle' }; return; }
      const handle = !!target.closest('[data-handle]');
      mode.current = { kind: 'press-node', node, start: pt, pen: e.pointerType === 'pen', handle };
      timer.current = setTimeout(() => {
        if (mode.current.kind === 'press-node') {
          mode.current = { kind: 'idle' };
          pointers.current.clear(); // меню перехватывает дальнейшие касания
          p.onMenu(node, e.clientX, e.clientY);
        }
      }, LONG_PRESS_MS);
    } else {
      mode.current = { kind: 'press-bg', start: pt, v0: vRef.current };
      setSelected(null);
      if (e.pointerType !== 'mouse') {
        timer.current = setTimeout(() => {
          if (mode.current.kind === 'press-bg') {
            mode.current = { kind: 'idle' };
            pointers.current.clear();
            p.onAddAt(toWorld(vRef.current, size, pt.x, pt.y));
          }
        }, LONG_PRESS_MS + 150);
      }
    }
  }

  function onPointerMove(e: RPE<HTMLDivElement>) {
    notePointer(e, 'move');
    if (!pointers.current.has(e.pointerId)) return;
    const pt = local(e);
    pointers.current.set(e.pointerId, pt);
    const m = mode.current;

    if (m.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const z = zoomAt(m.v0, size, m.mid0.x, m.mid0.y, dist(a, b) / m.d0);
      setV({ ...z, x: z.x + mid.x - m.mid0.x, y: z.y + mid.y - m.mid0.y });
      return;
    }
    if (m.kind === 'press-bg' && dist(pt, m.start) > MOVE_SLOP) { clearTimer(); mode.current = { kind: 'pan', start: m.start, v0: m.v0 }; }
    if (mode.current.kind === 'pan') {
      const pm = mode.current;
      setV({ ...pm.v0, x: pm.v0.x + pt.x - pm.start.x, y: pm.v0.y + pt.y - pm.start.y });
      return;
    }
    if (m.kind === 'press-node' && dist(pt, m.start) > MOVE_SLOP) {
      clearTimer();
      mode.current = m.pen || m.handle ? { kind: 'connect', node: m.node } : { kind: 'drag', node: m.node, start: m.start };
    }
    const cm = mode.current;
    if (cm.kind === 'drag') {
      const pl = cm.node.placement;
      setDragPos({ id: pl.id, x: pl.x + (pt.x - cm.start.x) / vRef.current.zoom, y: pl.y + (pt.y - cm.start.y) / vRef.current.zoom });
    } else if (cm.kind === 'connect') {
      setDraft({ from: cm.node.entity.id, to: toWorld(vRef.current, size, pt.x, pt.y) });
      const t = nodeAt(e.clientX, e.clientY);
      setHoverTarget(t && t.entity.id !== cm.node.entity.id ? t.entity.id : null);
    }
  }

  function onPointerUp(e: RPE<HTMLDivElement>) {
    notePointer(e, 'up');
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    clearTimer();
    const m = mode.current;
    if (m.kind === 'pinch') { mode.current = pointers.current.size ? { kind: 'idle' } : { kind: 'idle' }; return; }
    mode.current = { kind: 'idle' };

    if (m.kind === 'drag' && dragPos) {
      p.onMove(m.node.placement, dragPos.x, dragPos.y);
      // dragPos остаётся до прихода новых данных — без «прыжка» назад
      setTimeout(() => setDragPos(null), 400);
    } else if (m.kind === 'connect') {
      const t = nodeAt(e.clientX, e.clientY);
      setDraft(null); setHoverTarget(null);
      if (t && t.entity.id !== m.node.entity.id) p.onConnect(m.node.entity.id, t.entity.id);
    } else if (m.kind === 'press-node') {
      const now = performance.now();
      const id = m.node.entity.id;
      if (lastTap.current.id === id && now - lastTap.current.at < DOUBLE_TAP_MS) {
        lastTap.current = { id: '', at: 0 };
        p.onOpen(m.node.entity);
      } else {
        lastTap.current = { id, at: now };
        setSelected(id);
      }
    } else if (m.kind === 'press-bg') {
      const now = performance.now();
      if (lastTap.current.id === 'bg' && now - lastTap.current.at < DOUBLE_TAP_MS) {
        lastTap.current = { id: '', at: 0 };
        p.onAddAt(toWorld(vRef.current, size, m.start.x, m.start.y));
      } else lastTap.current = { id: 'bg', at: now };
    }
  }

  function onPointerCancel(e: RPE<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    clearTimer();
    mode.current = { kind: 'idle' };
    setDraft(null); setDragPos(null);
  }

  function onWheel(e: RWE) {
    const pt = local(e);
    if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 1.5 && e.deltaMode !== 0) {
      setV((cur) => zoomAt(cur, size, pt.x, pt.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002))));
    } else if (e.shiftKey || Math.abs(e.deltaX) > 0) {
      setV((cur) => ({ ...cur, x: cur.x - e.deltaX, y: cur.y - e.deltaY }));
    } else {
      setV((cur) => zoomAt(cur, size, pt.x, pt.y, Math.exp(-e.deltaY * 0.0015)));
    }
  }

  function onContextMenu(e: RME) {
    e.preventDefault();
    const n = nodeAt(e.clientX, e.clientY);
    if (n) p.onMenu(n, e.clientX, e.clientY);
    else p.onAddAt(toWorld(vRef.current, size, local(e).x, local(e).y));
  }

  function onKey(e: RKE, node: MapNode) {
    if (e.key === 'Enter') p.onOpen(node.entity);
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      p.onMenu(node, r.right, r.top);
    }
  }

  const layer: CSSProperties = { transform: `translate(${size.w / 2 + v.x}px, ${size.h / 2 + v.y}px) scale(${v.zoom})` };
  const bg = {
    backgroundPosition: `${size.w / 2 + v.x}px ${size.h / 2 + v.y}px`,
    '--grid': `${64 * v.zoom}px`,
  } as CSSProperties;
  const draftFrom = draft ? posOf(draft.from) : undefined;

  return (
    <div
      ref={box}
      className={`map theme-${p.theme}${p.connectFrom ? ' is-connecting' : ''}`}
      style={bg}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={(e) => { if (pointers.current.has(e.pointerId) && mode.current.kind !== 'drag' && mode.current.kind !== 'connect') onPointerCancel(e); }}
      onWheel={onWheel}
      onContextMenu={onContextMenu}
      data-testid="map"
    >
      <div className="map__layer" style={layer}>
        <Edges relations={p.relations} pos={posOf} draft={draft && draftFrom ? { from: draftFrom, to: draft.to } : null} />
        {p.nodes.map((n) => {
          const pos = dragPos?.id === n.placement.id ? dragPos : n.placement;
          return (
            <div
              key={n.placement.id}
              className={`map__node${dragPos?.id === n.placement.id ? ' is-dragging' : ''}`}
              style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
              data-node={n.entity.id}
              tabIndex={0}
              role="button"
              aria-label={n.entity.title}
              onKeyDown={(e) => onKey(e, n)}
            >
              <NodeCard
                entity={n.entity}
                selected={selected === n.entity.id || p.connectFrom === n.entity.id}
                target={hoverTarget === n.entity.id}
                outside={p.outside[n.entity.id] ?? 0}
                sketch={p.sketches[n.entity.id]}
              />
            </div>
          );
        })}
      </div>
      {!p.nodes.length && p.emptyHint && <div className="map__empty">{p.emptyHint}</div>}
      <div className="map__zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button aria-label="Приблизить" onClick={() => setV((c) => zoomAt(c, size, size.w / 2, size.h / 2, 1.25))}>+</button>
        <button aria-label="Отдалить" onClick={() => setV((c) => zoomAt(c, size, size.w / 2, size.h / 2, 0.8))}>−</button>
        <button aria-label="Показать всё" title="Показать всё" onClick={() => setV(fitTo(p.nodes.map((n) => n.placement), size))}>◎</button>
      </div>
    </div>
  );
}
