// Математика камеры карты. Viewport хранит смещение начала координат мира
// относительно центра экрана — поэтому вид не зависит от размера устройства.
import type { Viewport } from '../core/model/types';

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.6;

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export interface Size { w: number; h: number }

/** Экранные координаты (внутри контейнера) → координаты мира. */
export function toWorld(v: Viewport, size: Size, sx: number, sy: number) {
  return { x: (sx - size.w / 2 - v.x) / v.zoom, y: (sy - size.h / 2 - v.y) / v.zoom };
}

/** Масштабирование вокруг точки экрана (точка под пальцами остаётся на месте). */
export function zoomAt(v: Viewport, size: Size, sx: number, sy: number, factor: number): Viewport {
  const zoom = clampZoom(v.zoom * factor);
  const k = zoom / v.zoom;
  const cx = sx - size.w / 2, cy = sy - size.h / 2;
  return { zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
}

/** Вписать узлы в экран. */
export function fitTo(points: { x: number; y: number }[], size: Size): Viewport {
  if (!points.length) return { x: 0, y: 0, zoom: 1 };
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const minX = Math.min(...xs) - 160, maxX = Math.max(...xs) + 160;
  const minY = Math.min(...ys) - 110, maxY = Math.max(...ys) + 110;
  const zoom = clampZoom(Math.min(1, size.w / (maxX - minX), size.h / (maxY - minY)));
  return { zoom, x: -((minX + maxX) / 2) * zoom, y: -((minY + maxY) / 2) * zoom };
}

/** Детерминированный «шум» по id — для органичного изгиба связей. */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}
