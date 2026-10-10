// Геометрия живой линии пера: контур переменной ширины по нажиму + сглаживание.
// Штрих хранится как точки [x, y, нажим]; контур строится при отрисовке.
import type { Stroke } from '../core/model/types';

type P = [number, number, number];

/** Сглаживание: скользящее среднее по соседним точкам. */
function smooth(points: P[]): P[] {
  if (points.length < 3) return points;
  return points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return p;
    const a = points[i - 1], b = points[i + 1];
    return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4, (a[2] + 2 * p[2] + b[2]) / 4];
  });
}

/** Нажим мыши всегда 0.5; у стилуса — настоящий. Для пальца имитируем по скорости. */
export function widthAt(stroke: Pick<Stroke, 'size' | 'tool'>, pressure: number) {
  const p = Math.max(0.05, Math.min(1, pressure));
  return stroke.tool === 'pencil' ? stroke.size * (0.45 + 0.4 * p) : stroke.size * (0.3 + 0.9 * p);
}

/** SVG-путь контура штриха (заливка, не обводка — так ширина меняется вдоль линии). */
export function strokePath(stroke: Pick<Stroke, 'size' | 'tool' | 'points'>): string {
  const pts = smooth(smooth(stroke.points));
  if (!pts.length) return '';
  if (pts.length === 1) {
    const [x, y, p] = pts[0];
    const r = widthAt(stroke, p) / 2;
    return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  }
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const w = widthAt(stroke, pts[i][2]) / 2;
    left.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    right.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  const f = (n: number) => n.toFixed(1);
  const line = (ps: [number, number][]) => ps.map(([x, y]) => `L${f(x)} ${f(y)}`).join('');
  const end = pts[pts.length - 1], start = pts[0];
  const re = widthAt(stroke, end[2]) / 2, rs = widthAt(stroke, start[2]) / 2;
  const r = right.slice().reverse();
  return `M${f(left[0][0])} ${f(left[0][1])}${line(left.slice(1))}`
    + `A${f(re)} ${f(re)} 0 0 1 ${f(r[0][0])} ${f(r[0][1])}${line(r.slice(1))}`
    + `A${f(rs)} ${f(rs)} 0 0 1 ${f(left[0][0])} ${f(left[0][1])}Z`;
}

/** Попадает ли точка в штрих (для ластика). */
export function hitsStroke(stroke: Stroke, x: number, y: number, radius: number): boolean {
  const pts = stroke.points;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
    const d = Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
    if (d <= radius + stroke.size / 2) return true;
  }
  return false;
}

export function strokesBounds(strokes: Stroke[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) for (const [x, y] of s.points) {
    if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}
